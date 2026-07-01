import os, sys

REQUIRED_KEYS = [
    "MAIL_SYSTEM",
    "SMTP_CLIENT_ID",
    "SMTP_CLIENT_SECRET",
    "MS_TENANT_ID",
    "MS_SENDER_EMAIL",
]

def main(env_file_path: str) -> None:
    if not os.path.exists(env_file_path):
        lines = []
    else:
        with open(env_file_path, "r") as f:
            lines = f.readlines()

    updates = {k: os.environ[k] for k in REQUIRED_KEYS if k in os.environ}
    missing = [k for k in REQUIRED_KEYS if k not in updates]
    if missing:
        print(f"Missing env vars: {missing}", file=sys.stderr)
        sys.exit(1)

    for i, line in enumerate(lines):
        if "=" in line and not line.strip().startswith("#"):
            key = line.split("=", 1)[0].strip()
            if key in updates:
                lines[i] = f"{key}={updates.pop(key)}\n"

    for key, value in updates.items():
        lines.append(f"{key}={value}\n")

    with open(env_file_path, "w") as f:
        f.writelines(lines)

    print(f"Updated {env_file_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: update_email_env.py <env-file-path>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
