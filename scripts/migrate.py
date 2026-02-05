from argparse import ArgumentParser
from datetime import datetime
import subprocess

argp = ArgumentParser()
subp = argp.add_subparsers(dest="action", required=True)

create_parser = subp.add_parser("create")
create_parser.add_argument("--name", "-n", required=True)

args = argp.parse_args()

template = """
import { type Kysely, sql } from "kysely";
import { type DB } from "../lib/db/db.generated.js";

export async function up(db: Kysely<DB>) {
}

export async function down(db: Kysely<DB>) {
}
""".lstrip()

def prettify_code(code: str):
    subprocess.check_output([])
    return code

if __name__ == "__main__":
    now = datetime.now()
    nowfmt = now.strftime("%Y%m%d%H%M%S")
    match args.action:
        case "create":
            with open(f"migrations/{nowfmt}_{args.name}.ts", "w") as f:
                f.write(template)
