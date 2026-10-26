"""Build the Truth Board page: inject data.json into template.html.

Usage: python3 build.py [-o /path/to/output.html]
Default output is truth-board.html next to this script.
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=os.path.join(HERE, "truth-board.html"))
    args = ap.parse_args()

    with open(os.path.join(HERE, "data.json")) as f:
        data = json.load(f)
    with open(os.path.join(HERE, "template.html")) as f:
        template = f.read()

    token = "__DATA_JSON__"
    if token not in template:
        sys.exit("template.html is missing the __DATA_JSON__ token")

    # </script> inside JSON strings would end the script tag early.
    payload = json.dumps(data).replace("</", "<\\/")
    out = template.replace(token, payload, 1)

    if "__DATA_JSON__" in out:
        sys.exit("more than one __DATA_JSON__ token in template.html")

    with open(args.output, "w") as f:
        f.write(out)
    print(f"wrote {args.output} ({len(out):,} bytes), data through {data['meta']['data_through']}")


if __name__ == "__main__":
    main()
