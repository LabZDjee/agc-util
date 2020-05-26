/* jshint esversion: 6 */

const { analyzeAgcFile, findInAgcFileStruct } = require("../agc-util");
const fs = require("fs");
const isEqual = require("lodash.isequal");
const chalk = require("chalk");

const agcFilename = "./tests/test.agc";
const legacyAgcFilename = "./tests/legacy-test.agc";
const legacy2AgcFilename = "./tests/legacy-test-2.agc";
const jsonFilename = "./tests/agcStruct.json";
const pathToIncorrectAgcs = "./tests/wrong-agcs";

const testLineRegex = /^#\s*test\s*=\s*([A-Z]+)\|(.*)\|([0-9]+)\s*$/;

console.log(chalk.yellow("Unit Tests"));

const plural = (n) => (n != 1 ? "s" : "");

// check that subStrings in wordArray are found in sequence in refString
// return length of wordArray in case of success
//  or -(one-based pos of word which is not found) in case of failure
function checkWordsInString(wordArray, refString) {
  let pos = 0;
  let i;
  for (i = 0; i < wordArray.length; i++) {
    pos = refString.indexOf(wordArray[i], pos);
    if (pos < 0) {
      return -i - 1;
    }
    pos += wordArray[i].length;
  }
  return i;
}

let errors = 0;
let step = 0;

try {
  console.log(`step ${++step}: check "analyzeAgcFile" on file "${agcFilename}"`);
  const lines = fs.readFileSync(agcFilename, "utf8").split(/\r?\n/);
  const agcStruct = analyzeAgcFile(lines);
  const agcRefStruct = JSON.parse(fs.readFileSync(jsonFilename, "utf8"));
  if (!isEqual(agcStruct, agcRefStruct)) {
    console.log(`FAILURE: result does not match test JSON file ${jsonFilename}`);
    errors++;
  }

  console.log(`step ${++step}: check "analyzeAgcFile" on incorrect files in "${pathToIncorrectAgcs}"`);
  const incorrectAgcs = fs.readdirSync(pathToIncorrectAgcs);
  let fileIndex;
  for (fileIndex = 0; fileIndex < incorrectAgcs.length; fileIndex++) {
    let digram, keywords, lineNb;
    try {
      const lines = fs.readFileSync(`${pathToIncorrectAgcs}/${incorrectAgcs[fileIndex]}`, "utf8").split(/\r?\n/);
      const matches = lines[0].match(testLineRegex);
      if (matches === null) {
        continue;
      }
      [digram, keywords, lineNb] = [matches[1], matches[2], parseInt(matches[3])];
      console.log(`sub-step ${step}.${fileIndex + 1}: test throw with error "${digram}"`);
      analyzeAgcFile(lines);
      errors++;
      console.log(chalk.red(`error in checking "${digram}" exception (${keywords}): should have thrown`));
    } catch (e) {
      if (e.category === undefined) {
        throw e;
      } else if (
        lineNb !== e.line ||
        digram !== e.category ||
        keywords.split(/\s+/).some((word) => e.explicit.indexOf(word) < 0)
      ) {
        errors++;
        console.log(chalk.red(`error in checking "${digram}" exception (${keywords})`));
      }
    }
  }

  console.log(`step ${++step}: check "findInAgcFileStruct" with some trash`);
  if (
    findInAgcFileStruct({ section: "foo" }, agcStruct) !== null ||
    findInAgcFileStruct({ section: "GCAUCalibrationData", metaTag: "foo" }, agcStruct) !== null ||
    findInAgcFileStruct({ section: "GCAUCalibrationData", object: "foo" }, agcStruct) !== null
  ) {
    console.log(chalk.red("findInAgcFileStruct failed to return null on query made to fail"));
  }

  let sectionIndex;
  let wordPos;
  console.log(`step ${++step}: check "findInAgcFileStruct" with sections boundaries`);
  for (sectionIndex = 0; sectionIndex < agcStruct.length; sectionIndex++) {
    const section = findInAgcFileStruct({ section: agcStruct[sectionIndex].name }, agcStruct);
    if (section.name !== "{Header}") {
      const wordList = ["$", section.name, "=", `"Start"`];
      if ((wordPos = checkWordsInString(wordList, lines[section.startLine - 1])) < 0) {
        errors++;
        console.log(
          chalk.red(
            `checking Start boundary for section "${section.name}": error with word/substring "${
              wordList[-wordPos - 1]
            }" at line ${section.startLine}`
          )
        );
      }
      wordList[3] = `"End"`;
      if ((wordPos = checkWordsInString(wordList, lines[section.endLine - 1])) < 0) {
        errors++;
        console.log(
          chalk.red(
            `checking End boundary for section "${section.name}": error with word/substring "${
              wordList[-wordPos - 1]
            }" at line ${section.endLine}`
          )
        );
      }
    }
  }

  console.log(`step ${++step}: check "findInAgcFileStruct" with metaData`);
  for (sectionIndex = 0; sectionIndex < agcStruct.length; sectionIndex++) {
    const section = agcStruct[sectionIndex];
    if (section.metaTags !== undefined) {
      const metaTags = section.metaTags;
      let metaDataIndex;
      for (metaDataIndex = 0; metaDataIndex < metaTags.length; metaDataIndex++) {
        const metaTagArray = findInAgcFileStruct(
          { section: section.name, dataTag: metaTags[metaDataIndex].name },
          agcStruct
        );
        for (let i = 0; i < metaTagArray.length; i++) {
          const metaTag = metaTagArray[i];
          const wordList = ["$", metaTag.name, "=", `"${metaTag.value}"`];
          if ((wordPos = checkWordsInString(wordList, lines[metaTag.line - 1])) < 0) {
            errors++;
            console.log(
              chalk.red(
                `checking datatag "${metaTag.name}" in section "${section.name}": error with word/substring "${
                  wordList[-wordPos - 1]
                }" at line ${metaTag.line}`
              )
            );
          }
        }
      }
    }
  }

  console.log(`step ${++step}: check "findInAgcFileStruct" with dataKeys`);
  for (sectionIndex = 0; sectionIndex < agcStruct.length; sectionIndex++) {
    const section = agcStruct[sectionIndex];
    if (section.data !== undefined) {
      const data = section.data;
      let dataIndex;
      for (dataIndex = 0; dataIndex < data.length; dataIndex++) {
        const dataArray = findInAgcFileStruct({ section: section.name, dataKey: data[dataIndex].name }, agcStruct);
        for (let i = 0; i < dataArray.length; i++) {
          const datum = dataArray[i];
          const wordList = [datum.name, "=", `"${datum.value}"`];
          if ((wordPos = checkWordsInString(wordList, lines[datum.line - 1])) < 0) {
            errors++;
            console.log(
              chalk.red(
                `checking data "${datum.name}" in section "${section.name}": error with word/substring "${
                  wordList[-wordPos - 1]
                }" at line ${datum.line}`
              )
            );
          }
        }
      }
    }
  }

  console.log(`step ${++step}: check "findInAgcFileStruct" with objects`);
  for (sectionIndex = 0; sectionIndex < agcStruct.length; sectionIndex++) {
    const section = agcStruct[sectionIndex];
    if (section.objects !== undefined) {
      const objects = section.objects;
      let objectIndex;
      for (objectIndex = 0; objectIndex < objects.length; objectIndex++) {
        const object = findInAgcFileStruct({ section: section.name, object: objects[objectIndex].name }, agcStruct);
        if (object !== objects[objectIndex]) {
          errors++;
          console.log(
            chalk.red(
              `failed to pinpoint object list for section "${section.name}", object "${objects[objectIndex].name}"`
            )
          );
        }
      }
    }
  }

  console.log(`step ${++step}: check "findInAgcFileStruct" with objects and attributes`);
  for (sectionIndex = 0; sectionIndex < agcStruct.length; sectionIndex++) {
    const section = agcStruct[sectionIndex];
    if (section.objects !== undefined) {
      const objects = section.objects;
      let objectIndex;
      for (objectIndex = 0; objectIndex < objects.length; objectIndex++) {
        const object = objects[objectIndex];
        let attributeIndex;
        for (attributeIndex = 0; attributeIndex < object.attributes.length; attributeIndex++) {
          const searchHint = { object: object.name, attribute: object.attributes[attributeIndex].name };
          if (attributeIndex % 2 === 0 || section.name !== "GCAUConfigurationData") {
            searchHint.section = section.name;
          }
          const attribute = findInAgcFileStruct(searchHint, agcStruct);
          const wordList = [object.name, attribute.readOnly ? ".!" : ".", attribute.name, "=", `"${attribute.value}"`];
          if ((wordPos = checkWordsInString(wordList, lines[attribute.line - 1])) < 0) {
            errors++;
            console.log(
              chalk.red(
                `checking "${object.name}.${attribute.name}" in section "${section.name}": error with word/substring "${
                  wordList[-wordPos - 1]
                }" at line ${attribute.line}`
              )
            );
          }
        }
      }
    }
  }

  console.log(`step ${++step}: check legacy AGC when a $Notes can span over several lines`);
  const legacyLines = fs.readFileSync(legacyAgcFilename, "utf8").split(/\r?\n/);
  const legacyAgcStruct = analyzeAgcFile(legacyLines);
  if (!isEqual(agcStruct, legacyAgcStruct)) {
    errors++;
    console.log(chalk.red("output struct of legacy file does not match expectation"));
  }
  const legacyNotes = findInAgcFileStruct({ section: "{Header}", metaTag: "Notes" }, legacyAgcStruct);
  if (legacyNotes === null) {
    errors++;
    console.log(chalk.red("no $Notes found in legacy test file"));
  } else {
    for (let i = 0; i < legacyNotes.length; i++) {
      if (legacyLines[legacyNotes[i].line - 1].startsWith("$Notes") === false) {
        errors++;
        console.log(chalk.red("correction on $Notes not done correctly"));
        break;
      }
    }
  }

  console.log(`step ${++step}: check legacy snags ($VLowLimit incorrect and missing $EquationAdditionals)`);
  const legacy2Lines = fs.readFileSync(legacy2AgcFilename, "utf8").split(/\r?\n/);
  const legacy2AgcStruct = analyzeAgcFile(legacy2Lines);
  if (findInAgcFileStruct({ section: "EquationAdditionals" }, legacy2AgcStruct) !== null) {
    errors++;
    console.log(chalk.red("section $EquationAdditionals should be missing"));
  }
  const vLowLimitDef = findInAgcFileStruct({ metaTag: "VLowLimit" }, legacy2AgcStruct);
  if (vLowLimitDef === null) {
    errors++;
    console.log(chalk.red("section $VLowLimit not found"));
  } else if (vLowLimitDef[0].value !== "123") {
    errors++;
    console.log(chalk.red("section $VLowLimit value incorrect"));
  } else if (legacy2Lines[vLowLimitDef[0].line - 1] !== `$VLowLimit = "123"`) {
    errors++;
    console.log(chalk.red("section $VLowLimit correction not done as expected"));
  }

  if (errors === 0) {
    console.log(chalk.greenBright(`PASS - completed ${step} step${plural(step)} succesfully`));
  } else {
    console.log(chalk.redBright(`FAIL - test failed with ${errors} error${plural(errors)} in ${step} steps`));
  }
} catch (e) {
  console.error(chalk.redBright(`Unexpected exception at step ${step}`));
  console.error(`Exception details: ${JSON.stringify(e)}`);
}
