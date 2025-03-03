# how to change css cookie policy
$EDITOR ./node_modules/@solid/community-server/dist/http/output/metadata/CookieMetadataWriter.js"
change "sameSite: 'lax'," with "sameSite: 'None', secure: true,"



