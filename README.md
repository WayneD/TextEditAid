TextEditAid
===========

This is the source for the chrome extension TextEditAid, which gives you a way
to use a GUI editor (or a filter script) on the text in a form's textarea
inputs.

You can install it from the chrome extension store, or you can use Chrome's
developer mode to load an unpacked extension by browsing to the extension
directory.

Server Requirement
------------------

To use this extension requires that you run some kind of HTTP server, which is
typically done on your local host for security reasons. The "servers" directory
has a perl script that can be used as a stand-alone server. If you use the
extension to edit secret info, be sure that you've reviewed your server setup
for safety (particularly the temp-file setup and connection auth). You should
also consider cleaning up the temp dir more rapidly (either by setting a 0-hour
expiration time in the script or by using other cleaning methods). The perl
script defaults to saving your edited text for at least 4 hours (just in case
you need to re-grab some recently edited text).  However, it only does the
expiration step at the end of each HTTP edit request because its logic is
concerned about saving space, not about security. Thus, you may want to
implement your own server if you need strong security.
