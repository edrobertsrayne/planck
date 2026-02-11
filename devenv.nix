{
  pkgs,
  lib,
  config,
  ...
}: {
  # https://devenv.sh/packages/
  packages = with pkgs; [
    jq
    just
    bun
    chromium
  ];

  env.CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";

  dotenv.enable = true;

  claude.code = {
    enable = true;
    mcpServers = {
      svelte = {
        type = "http";
        url = "https://mcp.svelte.dev/mcp";
      };
      playwright = {
        type = "stdio";
        command = "docker";
        args = ["run" "-i" "--rm" "mcp/playwright"];
      };
    };
  };

  # https://devenv.sh/languages/
  languages = {
    javascript = {
      enable = true;
      bun = {
        enable = true;
        install.enable = true;
      };
    };
  };

  # https://devenv.sh/git-hooks/
  git-hooks.hooks = {
    eslint = {
      enable = true;
      name = "eslint";
      entry = "bunx eslint --fix";
      files = "\\.(js|ts|svelte)$";
    };

    prettier = {
      enable = true;
      name = "prettier";
      entry = "bunx prettier --write --ignore-unknown";
      types = ["text"];
    };

    unit-tests = {
      enable = true;
      name = "unit-tests";
      entry = "bun run test:unit -- --run";
      files = "\\.(js|ts|svelte)$";
      pass_filenames = false;
    };
  };

  # https://devenv.sh/processes/
  processes = {
    dev.exec = "bun run dev";
  };

  # See full reference at https://devenv.sh/reference/options/
}
