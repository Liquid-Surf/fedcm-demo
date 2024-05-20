# FedCM component

A FedCM component that can be injected into a
[Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer/) (CSS) instance
using [Components.js](https://github.com/LinkedSoftwareDependencies/Components.js/).


It allows to login to CSS using Federated Credential Management ( FedCM ).

o extend this, see https://jestjs.io/docs/configuration.

# Usage: Standalone

```
npm i
npm run start
```


# Usage: Integrate it to a CSS instance

In your CSS repo run `npm i css-fedcm-module --save`

In your `config.json` :

 - add `"https://linkedsoftwaredependencies.org/bundles/npm/css-fedcm-module/^7.0.0/components/context.jsonld"` to your "@context"
 - replace `"css:config/http/handler/default-with-fedcm.json",`
  by `"fedcm:config/http/handler/default-with-fedcm.json",`
 - add the following to your graph
```
{
      "@id": "urn:fedcm:default:fedcmLoginTemplateOverride",
      "@type": "Override",
      "overrideInstance": { "@id": "urn:solid-server:default:PasswordLoginHtml" },
      "overrideParameters": {
        "@type" : "HtmlViewEntry",
        "comment": "Should we use relative path bellow ? aliases like @fedcm doesn't seems to work",
        "filePath": "./templates/identity/password/login.html.ejs",
        "route": { "@id": "urn:solid-server:default:LoginPasswordRoute" }
      }
    }
```



