from mitmproxy import http
import re
import json
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

class ModifyResponse:
    def __init__(self):
        self.url_pattern = re.compile(r"^http://localhost:3001/\.oidc/auth\?.+$")

    def response(self, flow: http.HTTPFlow) -> None:
        
        if not flow.request.path.startswith('/.oidc/auth'):
            return

        query = flow.request.query

        bypass = query.get("bypass", "")

        if bypass and bypass == 'true':
          return

        redirect_uri = query.get("redirect_uri")
        code_challenge = query.get("code_challenge", "")
        code_challenge_method = query.get("code_challenge_method", "")
        state = query.get("state", "")
        client_id = query.get("client_id", "")

        if not redirect_uri:
            return

        parsed = urlparse(redirect_uri)
        qs = parse_qs(parsed.query)
        
        qs["_state"]                 = [state]
        qs["code_challenge"]        = [code_challenge]
        qs["code_challenge_method"] = [code_challenge_method]
        qs["client_id"]             = [client_id]

        new_query = urlencode(qs, doseq=True)
        new_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment
        ))

        flow.response.status_code = 302
        flow.response.headers["Location"] = new_url
        flow.response.text = ""

addons = [
    ModifyResponse()
]
