{
  description = "node devshell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.nodejs_24
          # pkgs.typescript
          # pkgs.nodePackages.pnpm
        ];
        shellHook = ''
          export PATH="$PWD/node_modules/.bin:$PATH"
          corepack enable >/dev/null 2>&1 || true
        '';
      };
    };
}

