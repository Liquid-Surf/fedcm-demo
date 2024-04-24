

# usage

```
npm i
npm run build
npm run start
```

First you need chrome canary with the `FedCM Authz` and `FedCM with IdP Registration support` flags enabled in `chrome://flags/`


 - create an account on [http://localhost:3000/.account/](http://localhost:3000/.account/) . Don't forget to add a pod to your account.

 - open a private window
 - first go to [http://localhost:3000/.account/](http://localhost:3000/.account/) and loggin
 - then go to the client at [http://localhost:6080](http://localhost:6080)
   - note: if you try to fetch your profile at `http://localhost:3000/<your_pod_name>/profile/` on step 3. You will get an error, as you need to be logged to access this resource.
 - Trigger the Dynamic Client Registration on 1)
 - Click the fedcm login button on 2)
 - Now try to fetch your profile on 3) again, you should receive the resource without an error.

# status

Currently the demo as been tested on debian with chromium  125.0.6422.0 (Developer Build).
Only the "classic" FedCM works, and the IdP registration needs to be implemted.
This demo doesn't pretend to be secure nor fully spec-compliant, but rather see how FedCM could improve Solid's UX.

# TODO

 - [X] Make FedCM work with Solid-OIDC
 - [ ] Add the IdP registration feature
   - [ ] Edit the CSS component to register to the user agent during sign in ( or sign up ? )
   - [ ] Modify the client to get register IdPs from the user agent
 - [ ] create npm package and publishing script
 - [ ] add it to https://pod.liquid.surf
