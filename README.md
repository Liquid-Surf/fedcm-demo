

# usage

```
npm i
npm run build
npm run start
```

First you need chrome canary with the `FedCM Authz` and `FedCM with IdP Registration support` flags enabled in `chrome://flags/`


 - create an account on [http://localhost:3000/.account/](http://localhost:3000/.account/) . Don't forget to add a pod to your account, then log out.

 - open a private window
 - first go to [http://localhost:3000/.account/](http://localhost:3000/.account/) , click `register IdP to FedCM`  and log in with the account created in the previous step
 - then go to the client at [http://localhost:6080](http://localhost:6080)
   - note: if you try to fetch your profile at `http://localhost:3000/<your_pod_name>/profile/` on step 3. You will get an error, as you need to be logged to access this resource.
 - Trigger the Dynamic Client Registration on 1)
 - Click the fedcm login button on 2)
 - Now try to fetch your profile on 3) again, you should receive the resource without an error.

# status

Currently the demo has been tested on Debian with Chromium 125.0.6422.0 (Developer Build).
Both the "classic" FedCM and the IdP registration works [#240](https://github.com/fedidcg/FedCM/issues/240#issuecomment-2004650817)
This demo doesn't pretend to be secure nor fully spec-compliant, but rather to see how FedCM could improve Solid's UX.

# TODO

 - [X] Make FedCM work with Solid-OIDC
 - [X] Add the IdP registration feature
   - [X] Edit the CSS component to register to the user agent during sign in ( or sign up ? )
   - [X] Modify the client to get register IdPs from the user agent
   - [ ] Match the Origin header against the RP origin determined by the client_id. Reject if they don't match. ( [3.5 - 2](https://fedidcg.github.io/FedCM/#idp-api-id-assertion-endpoint) )
 - [ ] create npm package and publishing script
 - [ ] add it to https://pod.liquid.surf
