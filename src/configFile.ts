import fs from "fs";
import path from "path";

export function configFile() {
  const p = process.env.npm_package_config_file!!;
  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          alchemyKey: "APIKEY",
          coinmarketcapKey: "APIKEY",
          etherscanKey: "APIKEY",
        },
        null,
        4
      ),
      { encoding: "utf8" }
    );
  }
  return JSON.parse(fs.readFileSync(path.resolve(p), { encoding: "utf8" }));
}
