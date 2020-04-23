/* jshint esversion: 6 */

const ignoreCase = require("ignore-case");

// accepted section markers
const sectionMarkers = [
  "GCAUConfigurationData",
  "GCAUCalibrationData",
  "BOM",
  "TestAdditionalTests",
  "SPReTPReOptions",
  "EquationAdditionals",
];

const headerSectionMarker = "{Header}";

const metaLineRegex = /^\$(\w+)\s*=\s*\"(.*)\"\s*$/;
const objectLineRegex = /^([A-Z][A-Z0-9_]*)\.(!?)([A-Za-z][A-Za-z0-9]*)\s*=\s*\"(.*)\"\s*$/;
const keyValueLineRegex = /^(\S+)\s*=\s*\"(.*)\"\s*$/;
const commentRegex = /^#.*$/;
const blankLineRegex = /^\s*$/;

// analyze lines of an .agc file and return an array of objects with the following structure:
//  name: string, name of section
//  startLine: number, line number of section start (inclusive)
//  endLine: number, line number of section end (inclusive)
//  metaTags: array of meta tags (tags starting with a $ sign) made of objects with the following structure
//   name: string, name of meta tag (without initial $ sign)
//   value: string, value of meta tag
//   line: number, line number where meta tag is located
//  objects: array of objects with the following struct:
//   name: string, object name
//   attributes: array of objects with the following struct:
//    name: string, attribute name
//    value: string, attribute value
//    readOnly: boolean, true if attribute is read-only
//    line: number, line number where meta tag is located
//  data: array of (key, value) pairs with the following struct:
//   name: string, the key
//   value: string
// if analyzed data are inconsistent this method will throw with the following error object:
//  line: number, the line which triggered the error
//  explicit: a message explaining the error
//  category: a digram categorizing the error:
//   CS: unexpected closing section
//   DA: duplicate attribute
//   DS: duplicate section
//   MC: missing closing section
//   MS: missing section
//   OS: unexpected opening section
//   UK: unexpected key
//   UL: unexpected line syntax
//   UM: unexpected meta tag
//   UO: unexpected object
// notes:
//   first unnamed section is given name "{Header}"
//   line numbers are one-based
//   first unnamed section can only have metaTags
//   only sections GCAUConfigurationData and GCAUCalibrationData can have objects, but no data
//   all other sections can have data but no objects
//   in any case, metaTags, objects, and data are all optional and will be undefined if not found in section
function analyzeAgcFile(lines) {
  const agcFileStruct = [{ name: headerSectionMarker, startLine: 1, endLine: 1, metaTags: [] }];
  let sectionIndex = 0;
  for (let n = 1; n <= lines.length; n++) {
    const line = lines[n - 1];
    let sectionClosed;
    if (commentRegex.test(line) || blankLineRegex.test(line)) {
      continue;
    }
    if (sectionIndex === 0) {
      agcFileStruct[0].endLine = n - 1;
      sectionClosed = false;
    } else {
      sectionClosed = agcFileStruct[sectionIndex].endLine >= 0;
    }
    let matches = line.match(metaLineRegex);
    if (matches !== null) {
      if (sectionMarkers.indexOf(matches[1]) >= 0) {
        if (ignoreCase.equals(matches[2], "Start")) {
          if (agcFileStruct[sectionIndex].endLine < 0) {
            throw {
              line: n,
              explicit: `unexpected opening section "${matches[1]}" in section "${agcFileStruct[sectionIndex].name}"`,
              category: `OS`,
            };
          }
          sectionIndex++;
          agcFileStruct.push({ name: matches[1], startLine: n, endLine: -1 });
        } else if (ignoreCase.equals(matches[2], "End")) {
          if (agcFileStruct[sectionIndex].name !== matches[1]) {
            throw {
              line: n,
              explicit: `unexpected closing section "${matches[1]}" in section "${agcFileStruct[sectionIndex].name}"`,
              category: `CS`,
            };
          }
          agcFileStruct[sectionIndex].endLine = n;
        }
      } else {
        if (sectionClosed) {
          throw {
            line: n,
            explicit: `unexpected metaTag "${matches[1]}" in section "${agcFileStruct[sectionIndex].name}"`,
            category: `UM`,
          };
        }
        if (agcFileStruct[sectionIndex].metaTags === undefined) {
          agcFileStruct[sectionIndex].metaTags = [];
        }
        agcFileStruct[sectionIndex].metaTags.push({ name: matches[1], value: matches[2], line: n });
      }
    } else if (["GCAUConfigurationData", "GCAUCalibrationData"].indexOf(agcFileStruct[sectionIndex].name) >= 0) {
      matches = line.match(objectLineRegex);
      if (matches === null) {
        throw { line: n, explicit: `unexpected line: "${line}"`, category: "UL" };
      }
      if (sectionClosed) {
        throw {
          line: n,
          explicit: `unexpected object "${matches[1]}" in closed section "${agcFileStruct[sectionIndex].name}"`,
          category: `UO`,
        };
      }
      if (agcFileStruct[sectionIndex].objects === undefined) {
        agcFileStruct[sectionIndex].objects = [];
      }
      const objects = agcFileStruct[sectionIndex].objects;
      const attribute = { name: matches[3], value: matches[4], readOnly: matches[2] === "!", line: n };
      if (objects.every((obj) => obj.name !== matches[1])) {
        objects.push({ name: matches[1], attributes: [attribute] });
      } else {
        for (let oi = 0; oi < objects.length; oi++) {
          if (objects[oi].name === matches[1]) {
            if (objects[oi].attributes.every((attr) => attr.name !== attribute.name) === false) {
              throw {
                line: n,
                explicit: `duplicate attribute "${attribute.name}" for object "${objects[oi].name}"`,
                category: "DA",
              };
            }
            objects[oi].attributes.push(attribute);
          }
        }
      }
    } else if (agcFileStruct[sectionIndex].name !== headerSectionMarker) {
      matches = line.match(keyValueLineRegex);
      if (matches === null) {
        throw { line: n, explicit: `unexpected line: "${line}"`, category: "UL" };
      }
      if (sectionClosed) {
        throw {
          line: n,
          explicit: `unexpected key "${matches[1]}" in closed section "${agcFileStruct[sectionIndex].name}"`,
          category: `UK`,
        };
      }
      if (agcFileStruct[sectionIndex].data === undefined) {
        agcFileStruct[sectionIndex].data = [];
      }
      agcFileStruct[sectionIndex].data.push({ name: matches[1], value: matches[2], line: n });
    } else {
      throw { line: n, explicit: `unexpected line: "${line}"`, category: "UL" };
    }
  }
  if (agcFileStruct[sectionIndex].endLine < 0) {
    throw {
      line: lines.length,
      explicit: `missing closing section: ${agcFileStruct[sectionIndex].name}`,
      category: "MC",
    };
  }
  const markerCounts = {};
  markerCounts[headerSectionMarker] = 0;
  sectionMarkers.forEach((v) => {
    markerCounts[v] = 0;
  });
  agcFileStruct.forEach((v) => {
    markerCounts[v.name]++;
  });
  for (const section in markerCounts) {
    if (markerCounts[section] === 0) {
      throw { line: lines.length, explicit: `section ${section} not found`, category: "MS" };
    }
    if (markerCounts[section] > 1) {
      const reducedAgcFS = agcFileStruct.filter((v) => v.name === section);
      throw { line: reducedAgcFS[1].startLine, explicit: `section ${section} is duplicate`, category: "DS" };
    }
  }
  return agcFileStruct;
}

function findFromNameinArray(name, array, key) {
  if (typeof key === "undefined") {
    key = "name";
  }
  if (!array.hasOwnProperty("length")) {
    return null;
  }
  for (let i = 0; i < array.length; i++) {
    if (!array[i].hasOwnProperty(key)) {
      return null;
    }
    if (name === array[i][key]) {
      return array[i];
    }
  }
  return null;
}

function findAllFromNameinArray(name, array, key) {
  let result = [];
  if (typeof key === "undefined") {
    key = "name";
  }
  if (!array.hasOwnProperty("length")) {
    return null;
  }
  for (let i = 0; i < array.length; i++) {
    if (!array[i].hasOwnProperty(key)) {
      return null;
    }
    if (name === array[i][key]) {
      result.push(array[i]);
    }
  }
  return result.length > 0 ? result : null;
}

// search a sub-object in 'agcFileStruct', matching certain properties given in 'searchHint' which is an object with the following properties:
//  section: string, section (defauts to: "GCAUConfigurationData")
//  metaTag: string, return the array of metaTags defined by (section and metaTag)
//  dataKey: string, return the array of data defined by (section and dataKey)
//  object: string, if alone, return the object defined by (section, object)
//  object, attribute: strings, return the attribute defined by (section, object, attribute)
// notes:
//  if metaTag is given object and attribute are ignored
//  if neither metaTag nor object are provided section object is returned
//  when not found, null is returned
//  metaTag and dataKey are returned as an array because it is allowed to have multiple values for each entry
function findInAgcFileStruct(searchHint, agcFileStruct) {
  if (!searchHint.hasOwnProperty("section")) {
    searchHint.section = "GCAUConfigurationData";
  }
  const section = findFromNameinArray(searchHint.section, agcFileStruct);
  if (section === null) {
    return null;
  }
  if (searchHint.hasOwnProperty("metaTag")) {
    return findAllFromNameinArray(searchHint.metaTag, section.metaTags);
  } else if (searchHint.hasOwnProperty("dataKey")) {
    return findAllFromNameinArray(searchHint.dataKey, section.data);
  } else if (searchHint.hasOwnProperty("object")) {
    const object = findFromNameinArray(searchHint.object, section.objects);
    if (object === null || !searchHint.hasOwnProperty("attribute")) {
      return object;
    }
    return findFromNameinArray(searchHint.attribute, object.attributes);
  }
  return section;
}

module.exports = { analyzeAgcFile, findInAgcFileStruct };
