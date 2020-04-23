/* jshint esversion: 6 */

// usage: node tests/json-maker (from project root directory)

const { analyzeAgcFile, findInAgcFileStruct } = require("../agc-util");
const fs = require("fs");
const isEqual = require("lodash.isequal");

const agcFilename = "tests/test.agc";
const jsonFilename = "tests/agcStruct.json";

try {
  console.log(`read file: ${agcFilename}`);
  const lines = fs.readFileSync(agcFilename, "utf8").split(/\r?\n/);

  console.log(`analyze its contents`);
  const agcStruct = analyzeAgcFile(lines);

  console.log(`save json result in ${jsonFilename}`);
  fs.writeFileSync(jsonFilename, JSON.stringify(agcStruct, null, 1));

  console.log(`read this file and compares with analyzed structure`);
  const agcStruct2 = JSON.parse(fs.readFileSync(jsonFilename, "utf8"));

  console.log(` result: ${isEqual(agcStruct, agcStruct2)}`);
} catch (e) {
  console.error("unable to build json file - error:", e);
}
