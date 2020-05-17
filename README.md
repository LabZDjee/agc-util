# AGC-UTIL

Agnostic utility to handle Protect-DC AGC configuration files

Anyone not aware of what a _Protect-DC_ system is, should not be interested in using this

This library essentially builds an ECMAScript array composed of objects and structures made of pointers (line numbers) to the AGC file contents

# Structure of an AGC File

This text file is composed of (key, value) pairs of this structure: `{key} = "{value}"`

<u>Note</u>: in this document, braces `{}` should not be taken literally, they denotes an entity inside which then should not be taken literally as well

Each such pair occupies one line (preferably cr/lf terminated, though this library doesn't care as it takes an array made of strings)

Any line which is blank (empty or only made of spaces and tabs) or starting with a pound sign `#` is ignored in the structure of the file

## Types of (key, value) Pairs

**Meta data**: `${key} = "{value}"`

**Object/attribute**: `{object}.{attribute} = "{value}"` or `{object}.!{attribute} = "{value}"` for read-only attributes

All other simple `{key} = "{value}"` pairs are considered plain **data**

## Sections

An AGC file is made of a number of _compulsory_ sections which have markers, except the first one which in considered the file header

Sections are framed by an opening line: `${sectionName} = "Start"` and a closing line `${section} = "End"`

First section comes before any other, has no opening and closing line

The following table enumerates those compulsory sections and what entities they support (no entity is compulsory and there is no limit in the number of instances of those entities)

| Section name            | Allowed entities            |
| ----------------------- | :-------------------------- |
| _(header)_              | meta data                   |
| `GCAUConfigurationData` | meta data, object-attribute |
| `GCAUCalibrationData`   | meta data, object-attribute |
| `BOM`                   | meta data, data             |
| `TestAdditionalTests`   | meta data, data             |
| `SPReTPReOptions`       | meta data, data             |
| `EquationAdditionals`   | meta data, data             |

# API

## `analyzeAgcFile(lines)`

Analyze `lines` array of an AGC file and return an **array** of **objects** with the following structure:

- `name`: string, name of section
- `startLine`: number, line number of section start (inclusive)
- `endLine`: number, line number of section end (inclusive)
- `metaTags`: array of meta tags (tags starting with a `$` sign) made of objects with the following structure:

  - `name`: string, name of meta tag (without initial \$ sign)
  - `value`: string, value of meta tag
  - `line`: number, line number where meta tag is located

- `objects`: array of objects with the following struct:

  - `name`: string, object name
  - `attributes`: array of `attribute` objects with the following struct:
    - `name`: string, attribute name
    - `value`: string, attribute value
    - `readOnly`: boolean, true if attribute is read-only
    - `line`: number, line number where attribute is located

- `data`: array of (key, value) pairs with the following struct:
  - `name`: string, the key
  - `value`: string

If analyzed data are inconsistent this method will throw with the following error object:

- `line`: number, the line which triggered the error
- `explicit`: a message explaining the error
- `category`: a digram categorizing the error:
  - `CS`: unexpected closing section
  - `DA`: duplicate attribute
  - `DS`: duplicate section
  - `MC`: missing closing section
  - `MS`: missing section
  - `OS`: unexpected opening section
  - `UK`: unexpected key
  - `UL`: unexpected line syntax
  - `UM`: unexpected meta tag
  - `UO`: unexpected object

_Notes:_

- first unnamed section is given name "`{Header}`"
- line numbers are one-based
- first unnamed section can only have _metaTags_
- only sections `GCAUConfigurationData` and `GCAUCalibrationData` can have objects, but no data
- all other sections can have data but no objects
- in any case, _metaTags_, objects, and data are all optional and will be undefined if not found in section
- array`lines` can be easily be build by `data.split(/\r?\n/)` provided by `readFile` function for example
- from version 1.2, to address a legacy case, where a single metaTag `$Notes` can span over multiple lines, `lines` array is preprocessed and if such a case is detected, this array undergoes a side effect (alteration): `$Notes` is expanded on as many lines as it is encountered, for example `$Notes = "abc\ndef\ghi"` (note the `\n` meaning this expression occupies 3 lines) will be expanded as `$Notes = "abc"`, `$Notes = "def"`, and `$Notes = "ghi"`

## `findInAgcFileStruct(searchHint, agcFileStruct)`

Search a sub-object in `agcFileStruct` (as returned by function `analyzeAgcFile`), matching certain properties given in `searchHint` which is an object with the following properties:

- `section`: string, section (defauts to: `"GCAUConfigurationData"`)
- `metaTag`: string, return the array of _metaTag_ objects defined by (`section` and `metaTag`)
- `dataKey`: string, return the array of _data_ objects defined by (`section` and `dataKey`)
- `object`: string, if alone, return the _object_ object defined by (`section` and `object`)
- `object`, `attribute`: strings, return the _attribute_ object defined by (`section`, `object`, and `attribute`)

_Notes_:

- if `metaTag` is given `object` and `attribute` are ignored
- if neither `metaTag` nor `object` are provided section object is returned
- when not found, `null` is returned
- metaTag and dataKey are returned as an array because it is allowed to have multiple values for each entry key

# Install and Use

Install:

`npm install @labzdjee/agc-util --save`

Use:

`const { analyzeAgcFile, findInAgcFileStruct } = require("@labzdjee/agc-util");`
