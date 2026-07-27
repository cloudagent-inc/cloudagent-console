#!/bin/sh

# CloudAgent Console source installer.
#
# This script installs a shallow source checkout, installs the locked npm
# dependencies, and builds the desktop UI. It does not install optional cloud,
# scanner, or agent CLIs and it does not modify the user's PATH or shell files.

set -eu

REPO_URL="${CLOUDAGENT_REPO_URL:-https://github.com/cloudagent-inc/cloudagent-console.git}"
REF="${CLOUDAGENT_REF:-main}"
INSTALL_DIR="${CLOUDAGENT_INSTALL_DIR:-}"
LAUNCH=false
VERBOSE=false

RESET=
BOLD=
BLUE=
GREEN=
YELLOW=
RED=

init_style() {
  if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    RESET="$(printf '\033[0m')"
    BOLD="$(printf '\033[1m')"
    BLUE="$(printf '\033[34m')"
    GREEN="$(printf '\033[32m')"
    YELLOW="$(printf '\033[33m')"
    RED="$(printf '\033[31m')"
  fi
}

usage() {
  cat <<'EOF'
CloudAgent Console source installer

Usage:
  install_oss.sh [options]

Options:
  --install-dir DIR  Source checkout location
                     (default: ~/.cloudagent-console/source)
  --repo URL         CloudAgent git repository URL
  --ref REF          Branch or tag to install (default: main)
  --launch           Launch CloudAgent after setup
  --verbose          Print commands before running them
  -h, --help         Show this help

Environment overrides:
  CLOUDAGENT_INSTALL_DIR
  CLOUDAGENT_REPO_URL
  CLOUDAGENT_REF
  NO_COLOR

Examples:
  ./scripts/install_oss.sh
  ./scripts/install_oss.sh --ref main --launch
EOF
}

step() {
  printf '%s==>%s %s\n' "$BLUE" "$RESET" "$1"
}

success() {
  printf '%s==>%s %s\n' "$GREEN" "$RESET" "$1"
}

warn() {
  printf '%sWARNING:%s %s\n' "$YELLOW" "$RESET" "$1" >&2
}

fail() {
  printf '%sERROR:%s %s\n' "$RED" "$RESET" "$1" >&2
  exit 1
}

run() {
  if [ "$VERBOSE" = true ]; then
    printf '  +'
    for argument in "$@"; do
      printf ' %s' "$argument"
    done
    printf '\n'
  fi
  "$@"
}

require_command() {
  command_name="$1"
  install_hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "$command_name is required. $install_hint"
  fi
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --install-dir)
        [ "$#" -ge 2 ] || fail "--install-dir requires a directory."
        INSTALL_DIR="$2"
        shift 2
        ;;
      --repo)
        [ "$#" -ge 2 ] || fail "--repo requires a URL."
        REPO_URL="$2"
        shift 2
        ;;
      --ref)
        [ "$#" -ge 2 ] || fail "--ref requires a branch or tag."
        REF="$2"
        shift 2
        ;;
      --launch)
        LAUNCH=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        fail "Unknown option: $1"
        ;;
    esac
  done
}

check_platform() {
  platform="$(uname -s)"

  case "$platform" in
    Darwin)
      step "Detected macOS"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      step "Detected Windows shell"
      ;;
    Linux)
      warn "Linux source setup can continue, but Linux is not an officially supported desktop platform yet."
      ;;
    *)
      fail "Unsupported platform: $platform"
      ;;
  esac
}

check_prerequisites() {
  require_command git "Install Git from https://git-scm.com/downloads and rerun this installer."
  require_command node "Install Node.js 20.19 or newer from https://nodejs.org and rerun this installer."
  require_command npm "Install npm with Node.js from https://nodejs.org and rerun this installer."

  node_version="$(node --version)"
  if ! node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1);
  '; then
    fail "CloudAgent requires Node.js 20.19 or newer. Current version: $node_version"
  fi

  step "Using Node.js $node_version and npm $(npm --version)"
}

prepare_checkout() {
  if [ -z "$INSTALL_DIR" ]; then
    [ -n "${HOME:-}" ] || fail "HOME is not set. Pass an explicit --install-dir."
    INSTALL_DIR="$HOME/.cloudagent-console/source"
  fi

  [ -n "$INSTALL_DIR" ] || fail "The install directory cannot be empty."
  [ -n "$REPO_URL" ] || fail "The repository URL cannot be empty."
  [ -n "$REF" ] || fail "The branch or tag cannot be empty."

  if [ -d "$INSTALL_DIR/.git" ]; then
    existing_remote="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
    if [ -n "$existing_remote" ] && [ "$existing_remote" != "$REPO_URL" ]; then
      fail "$INSTALL_DIR uses a different origin ($existing_remote). Choose another --install-dir or pass --repo $existing_remote."
    fi

    tracked_changes="$(git -C "$INSTALL_DIR" status --porcelain --untracked-files=no)"
    if [ -n "$tracked_changes" ]; then
      fail "$INSTALL_DIR has tracked changes. Commit or discard them before updating."
    fi

    step "Updating the existing checkout at $INSTALL_DIR"
    run git -C "$INSTALL_DIR" fetch --depth 1 -- origin "$REF"
    run git -C "$INSTALL_DIR" checkout --detach FETCH_HEAD
  elif [ -e "$INSTALL_DIR" ]; then
    fail "$INSTALL_DIR already exists and is not a CloudAgent git checkout."
  else
    step "Cloning CloudAgent $REF into $INSTALL_DIR"
    run mkdir -p "$(dirname "$INSTALL_DIR")"
    run git clone --depth 1 --branch "$REF" -- "$REPO_URL" "$INSTALL_DIR"
  fi

  [ -f "$INSTALL_DIR/package.json" ] || fail "The checkout does not contain package.json."
  [ -f "$INSTALL_DIR/package-lock.json" ] || fail "The checkout does not contain package-lock.json."
}

install_cloudagent() {
  step "Installing locked npm dependencies"
  (
    cd "$INSTALL_DIR"
    run npm ci --no-audit --no-fund
  )

  step "Building the desktop UI"
  (
    cd "$INSTALL_DIR"
    run npm run build:desktop-ui
  )
}

print_next_steps() {
  printf '\n%sCloudAgent Console source setup is complete.%s\n\n' "$BOLD" "$RESET"
  printf 'Start CloudAgent:\n'
  printf '  cd "%s"\n' "$INSTALL_DIR"
  printf '  npm run electron:local\n\n'
  printf 'Optional tools such as AWS CLI, Trivy, CloudFormation Guard, Codex,\n'
  printf 'Claude Code, and Cursor are configured separately in Preferences.\n'
}

main() {
  init_style
  parse_args "$@"
  check_platform
  check_prerequisites
  prepare_checkout
  install_cloudagent
  success "Installed CloudAgent Console from $REF"
  print_next_steps

  if [ "$LAUNCH" = true ]; then
    step "Launching CloudAgent Console"
    (
      cd "$INSTALL_DIR"
      run npm run electron:local
    )
  fi
}

main "$@"
