#!/usr/bin/env python3
#
# A simple web server that just listens for textarea filter requests and runs
# an editor to manipulate the text.  Is intended to be used with the
# TextEditAid extension for Chrome.
#
# This script is freely redistributable and is offered for use without any
# warranty.  If you choose to edit private data with it, it is up to you to
# make certain that the software is configured to keep your information safe!
#
# NOTE: It is safest to avoid using this on a shared system.  While it limits
# connections to localhost and requires the use of a username & password (by
# default), you'd need to do a security audit to make sure that it was setup
# safely in a shared environment, and that is not very easy to do.

import os
import sys
import time
import glob
import shlex
import urllib.parse
import tempfile
import argparse
import subprocess
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --- Configuration ---

# If you don't want to require authentication, set REQUIRE_AUTH to False.
# When it is set to True, the first authenticated request that is received
# will be saved to the SAVE_AUTH_FILE file.  All subsequent requests
# are compared to that value.  To change your password, just remove the
# file and make a new edit-server request using the new auth info.
REQUIRE_AUTH = True
SAVE_AUTH_FILE = os.path.expanduser('~/.edit-server-auth')

# Only accept requests from something that claims to be a chrome-extension.
# Set this to False if you want other things to be able to use this script.
REQUIRE_CHROME_EXTENSION = True

# Configures the port we listen on and if we allow only localhost requests.
PORT = 8888
LOCALHOST_ONLY = True

# Configure the program that you want to run to handle the requests.
# This editor invocation must NOT return control to this script until
# you are done editing! Note that you can put additional munging into
# the munge_bytes() function.
EDITOR_CMD = '/usr/bin/rgvim -f SAFE_ARG'
#EDITOR_CMD = '/usr/bin/emacsclient -c SAFE_ARG'
#EDITOR_CMD = False # Write the tmp file, but don't run a program
#EDITOR_CMD = None # Don't write the tmp file or run a program

# The settings to configure the temp dir and how soon old files are removed.
# If TMP_PREFIX contains the string -URL64- (or any number), then the chars
# of the munged URL for the textarea's page will be included in the tmp file's
# filename, with a maximum length matching the specified number.
TMP_MATCH_RE = re.compile(r'-URL(\d+)-')
TMP_DIR = '/tmp'
TMP_PREFIX = 'edit-server-URL64-'
TMP_SUFFIX = '.txt'
CLEAN_AFTER_HOURS = 4

def main():
    # Disables all "group" and "other" perms when saving files.
    os.umask(0o077)

    server_address = ('127.0.0.1' if LOCALHOST_ONLY else '', args.port)

    try:
        httpd = ThreadingHTTPServer(server_address, EditServerHandler)
        if args.verbose >= 1:
            print(f"Starting edit-server on port {args.port}...")
        httpd.serve_forever()
    except OSError as e:
        print(f"Couldn't start server: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        if args.verbose >= 1:
            print("\nShutting down edit-server...")
        httpd.server_close()
        sys.exit(0)


class EditServerHandler(BaseHTTPRequestHandler):
    def send_error_response(self, code, message):
        self.send_response(code, message)
        self.send_header('Server', 'edit-server')
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(f"{code} {message}\n".encode('utf-8'))

    def do_GET(self):
        # We only support POST, but return a helpful message for anything else.
        self.send_response(200, 'OK')
        self.send_header('Server', 'edit-server')
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Server is up and running. To use it, issue a POST request with the file to edit as the content body.")
    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        if args.verbose >= 1:
            print(f"Path: {self.path}")

        if args.verbose >= 2:
            for key, value in self.headers.items():
                print(f"Header: {key.lower()} = {value}")
            print("-" * 67)

        # Authentication check
        if args.require_auth:
            authorized = False
            auth_header = self.headers.get('Authorization') # e.g. "Basic 01234567890ABCDEF=="

            if auth_header:
                auth_line = None
                try:
                    if os.path.exists(SAVE_AUTH_FILE):
                        with open(SAVE_AUTH_FILE, 'r') as f:
                            auth_line = f.read().strip()
                    else:
                        # The first request w/o an auth file saves the auth info.
                        with open(SAVE_AUTH_FILE, 'w') as f:
                            f.write(auth_header.strip() + '\n')
                        auth_line = auth_header.strip()
                except OSError as e:
                    self.send_error_response(501, 'Internal failure -- auth-file failed.')
                    return

                if auth_line == auth_header.strip():
                    authorized = True

            if not authorized:
                self.send_error_response(401, 'Unauthorized!')
                return

        # Chrome extension check
        if REQUIRE_CHROME_EXTENSION:
            origin = self.headers.get('Origin')
            if not origin or not origin.startswith('chrome-extension:'):
                self.send_error_response(401, 'Unauthorized.')
                return

        # Content length check
        content_length = self.headers.get('Content-Length')
        if not content_length or not content_length.isdigit():
            self.send_error_response(500, 'Invalid request -- no content-length.')
            return

        length = int(content_length)
        field_bytes = self.rfile.read(length)

        if len(field_bytes) != length:
            self.send_error_response(500, 'Invalid request -- wrong content-length.')
            return

        field_bytes = munge_bytes(field_bytes)

        if EDITOR_CMD is not None: # False also writes the file
            (success, temp_path) = write_temp_file(self.path, field_bytes)
            if not success:
                # temp_path contains the thrown error text
                self.send_error_response(500, f'Failed to create temporary file: {temp_path}')
                return
        else:
            temp_path = None

        # Execute editor command
        if EDITOR_CMD:
            # Replace SAFE_ARG with the safely quoted filename to prevent shell injection
            cmd = EDITOR_CMD.replace('SAFE_ARG', shlex.quote(temp_path))

            try:
                subprocess.run(cmd, shell=True)
            except Exception as e:
                self.send_error_response(500, f"Failed to run editor: {e}")
                return

        if temp_path:
            (success, field_bytes) = read_temp_file(temp_path)
            if not success:
                # field_bytes contains the thrown error text
                self.send_error_response(500, f"Unable to re-open {temp_path}: {field_bytes}")
                return

        # Send successful response
        self.send_response(200, 'OK')
        self.send_header('Server', 'edit-server')
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(field_bytes)

        # Trigger cleanup
        clean_old_tempfiles()


def write_temp_file(url_path, field_bytes):
    # Parse query string to construct filename prefix
    prefix = TMP_PREFIX
    m = TMP_MATCH_RE.search(prefix)
    if m:
        parsed_url = urllib.parse.urlparse(url_path)
        url_part = url_filename(parsed_url.query, int(m.group(1)))
        prefix = TMP_MATCH_RE.sub('-' + url_part + '-', prefix)

    # Create temporary file
    try:
        fd, temp_path = tempfile.mkstemp(suffix=TMP_SUFFIX, prefix=prefix, dir=TMP_DIR)
        with os.fdopen(fd, 'wb') as f:
            f.write(field_bytes)
    except OSError as e:
        return (False, str(e))

    return (True, temp_path)


def read_temp_file(temp_path):
    # Read back edited content
    try:
        with open(temp_path, 'rb') as f:
            return (True, f.read())
    except OSError as e:
        return (False, str(e))


def clean_old_tempfiles():
    """Clean up old temp files that have been around for a few hours."""
    cutoff_time = time.time() - (CLEAN_AFTER_HOURS * 3600)
    # Match the pattern of our temporary files
    search_pattern = os.path.join(TMP_DIR, f"edit-server-*{TMP_SUFFIX}")

    if args.verbose >= 3:
        print(f"Match: {search_pattern}")

    for fn in glob.glob(search_pattern):
        if args.verbose >= 3:
            print(f"Fn: {fn}")

        try:
            mtime = os.path.getmtime(fn)
            age_hours = (time.time() - mtime) / 3600
            if age_hours > CLEAN_AFTER_HOURS:
                os.remove(fn)
                if args.verbose >= 3:
                    print(f"Removed {fn} (Age: {age_hours:.2f} hours)")
            else:
                if args.verbose >= 3:
                    print(f"Kept {fn} (Age: {age_hours:.2f} hours)")
        except OSError as e:
            if args.verbose >= 3:
                print(f"Failed to check/remove {fn}: {e}")


def url_filename(query_string, max_chars):
    """Parses the URL from the query string and creates a safe filename."""
    if args.verbose >= 4:
        print(f"Query: {query_string}")

    if query_string:
        query_params = urllib.parse.parse_qs(query_string)
        if 'url' in query_params:
            val = query_params['url'][0]
            if args.verbose >= 4:
                print(f"Before: {val}")
            val = re.sub(r'^https?://', '', val)
            val = re.sub(r'[^\-\w.]', '_', val)
            val = val[:max_chars]
            if args.verbose >= 4:
                print(f"After: {val}")
            return val

    return 'unknown-url'


def munge_bytes(txt):
    # """Internal tweaking of the TEXTAREA can occur here."""
    # NOTE: the txt is in bytes format!
    #txt = txt + b' WOWZA!'
    return txt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="A simple web server that listens for textarea filter requests and runs an editor.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    a_def = ' (DEFAULT)' if REQUIRE_AUTH else ''
    no_a_def = ' (DEFAULT)' if not REQUIRE_AUTH else ''
    parser.add_argument('--port', '-p', type=int, default=PORT, help=f"Change the port we listen on (default: {PORT})")
    parser.add_argument('--auth', action='store_true', default=REQUIRE_AUTH, dest='require_auth', help="Require username/password authentication." + a_def)
    parser.add_argument('--no-auth', action='store_false', dest='require_auth', help="Don't require username/password authentication." + no_a_def)
    parser.add_argument('--verbose', '-v', action='count', default=0, help="Increase debug verbosity (repeatable)")
    args = parser.parse_args()

    main()
