Files in this folder are faulty AGC files which are made for the test program to check function `analyzeAgcFile` will throw an error

Each first line in those files has to have the follwing structure: `#test = {digram}|{keyWords}|{lineNumber}`

Where _digram_ and _lineNumber_ represent fields contents of `line` and `category` of the error object thrown and _keyWords_ conatins words which should appear in string explicit of this error object
