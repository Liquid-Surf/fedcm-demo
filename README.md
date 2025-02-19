

# usage
Requires [bun](https://bun.sh/docs/installation).
```
npm i
npm run build
npm run start
```

First you need to use a browser that supports FedCM, such as:
* use Chrome >= 128, go to chrome://flags and enter "fedcm" to filter the flags
* Enable "FedCM with IdP Registration support" and "FedCmMultiIdp"

## On localhost

 - create an account on [http://localhost:3000/.account/](http://localhost:3000/.account/) . Don't forget to add a pod to your account, then log out.

 - open a private window
 - first go to [http://localhost:3000/.account/](http://localhost:3000/.account/) , click `register IdP to FedCM`  and log in with the account created in the previous step
 - then go to the client at [http://localhost:6080](http://localhost:6080)
 - under section 3) of the page, edit the textbox so that it has your profile folder `http://localhost:3000/<your_pod_name>/profile/` instead of `http://localhost:3000/a/profile/`
 - confirm that 'Fetch resource' results in a 401 error.
 - under section 2) of the page, click the fedcm login button. It will offer to log you in as 'John Doe', but with your WebID from the previous step.
 - confirm that your WebID and an access token appear.
 - click 'Fetch resource' again. It should display an `ldp:Container` description

## hosted

if the client and CSS don't have the same domain or subdomain, the current CSS instance in `./packages/fedcm-component/` won't work because FedCM require cookies with `SameSite=None` cookie policiy, which introduce security issue. 
Please refer to [this repo](https://github.com/thhck/fedcm-css-exp) to see how to enable `SameSite=None` on CSS. 
A workaround can be implemented: https://github.com/w3c-fedid/FedCM/issues/587#issuecomment-2358814630 but not sure how safe it is.   

# demo

[video demo](./demo_video/demo_2.mp4)
[client](https://fedcm-client.liquid.surf/)
[css](https://exp.liquid.surf/)

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
 - [X] add it to https://pod.liquid.surf ( used exp.liquid.surf instead )
