{
  description = "3d-gallery viewer development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pnpm
            gitleaks
            lefthook
          ];

          shellHook = ''
            echo "3d-gallery dev env — node $(node --version), pnpm $(pnpm --version)"
          '';
        };
      }
    );
}
