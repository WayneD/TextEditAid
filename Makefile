zip:
	(cd extension && zip ../TextEditAid.zip `find * -type f -print`)

.PHONY: zip

clean:
	rm -f TextEditAid.zip
