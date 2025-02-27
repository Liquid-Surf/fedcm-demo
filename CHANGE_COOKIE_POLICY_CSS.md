
it's important to test cases where the client and idp are not on
the same domain ( not both on localhost )

However in this case FedCM require to have a SameSite=None cookie
policy from the IdP. To change that:

open:
 ./node_modules/@solid/community-server/dist/http/output/metadata/CookieMetadataWriter.js +39:1
 and change 'Lax' to 'None', and add `secure: true` to the object.

also, change the /etc/hosts like explained in the readme:


On linux ( and probably mac ), run `sudo $EDITOR /etc/hosts` and add
```
127.0.0.1       idp.localhost
127.0.0.1       rp.localhost
```
at the end of the file.

# run it with loca.lt

 lt --port 3000 --host https://localtunnel.me
 lt --port 6080 --host https://localtunnel.me

 remember to start css with -b {local_tunnel_url}
 remember to change the url in the client
  - in index.html, solid.js and server.js


