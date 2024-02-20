/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020, 2014 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as fs from "fs"
import { Node } from "./idl-node"
import { Lexer } from "./idl-lexer"
import { specification } from "./idl-parser"

import { writeTSInterface } from "./ts/write-interface"
import { writeTSSkeleton } from "./ts/write-skeleton"
import { writeTSStub } from "./ts/write-stub"
import { writeTSValue } from "./ts/write-value"
import { writeTSValueType } from "./ts/write-valuetype"
import { writeTSValueImpl } from "./ts/write-valueimpl"

import { writeCCInterface } from "./cc/write-interface"
import { writeCCSkeleton } from "./cc/write-skeleton"
import { writeCCStub } from "./cc/write-stub"
import { writeCCCode } from "./cc/write-code"

import { filenamePrefix, filename, setFilename, setFilenamePrefix, setFilenameLocal } from "./util"


function printHelp() {
    console.log(
        `corba.js IDL compiler
Copyright (C) 2018, 2020, 2021, 2024 Mark-André Hopf <mhopf@mark13.org>
This is free software; see the source for copying conditions.  There is
ABSOLUTELY NO WARRANTY; not even for MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.

Usage: corba-idl [options] file...
Options:
  --(ts|cc)-all        create all TypeScript/C++ files
  --(ts|cc)-interface  create TypeScript/C++ interface file for stub and skeleton
  --(ts|cc)-stub       create TypeScript/C++ stub file
  --(ts|cc)-skeleton   create TypeScript/C++ skeleton file
  --(ts|cc)-valuetype  create TypeScript/C++ valuetype file
  --cc-code            create implementation file
  --verbose|-v    increase verbosity level
  --output-directory|-o <dir>
                  create files in <dir>
  --help|-h       this page
`)
}

let verbose = 0,
    outputDirectory: string | undefined,
    tsInterface = false,
    tsStub = false,
    tsSkeleton = false,
    tsValueType = false,
    tsValueImpl = false,
    ccInterface = false,
    ccStub = false,
    ccSkeleton = false,
    ccValueType = false,
    ccValueImpl = false,
    ccCode = false

function main() {
    let i = parseArguments()
    for (; i < process.argv.length; ++i) {
        setupFilenameVars(process.argv[i])
        let syntaxTree = parseIDLFile()
        if (verbose > 1)
            syntaxTree.printTree()
        createOutputFiles(syntaxTree)
    }
}

main()

function parseArguments(): number {
    let i
    argloop: for (i = 2; i < process.argv.length; ++i) {
        switch (process.argv[i]) {
            case "--":
                ++i
                break argloop

            case "--ts-all":
                tsInterface = tsStub = tsSkeleton = tsValueType = true
                break
            case "--ts-interface":
                tsInterface = true
                break
            case "--ts-stub":
                tsStub = true
                break
            case "--ts-skeleton":
                tsSkeleton = true
                break
            case "--ts-valuetype":
                tsValueType = true
                break
            // case "--ts-valueimpl":
            //     tsValueImpl = true
            //     break

            case "--cc-all":
                ccInterface = ccStub = ccSkeleton = ccValueType = ccCode = true
                break
            case "--cc-interface":
                ccInterface = true
                break
            case "--cc-stub":
                ccStub = true
                break
            case "--cc-skeleton":
                ccSkeleton = true
                break
            case "--cc-valuetype":
                ccValueType = true
                break
            case "--cc-code":
                ccCode = true
                break

            case "--output-directory":
            case "-o":
                outputDirectory = process.argv[++i]
                break
            case "--verbose":
            case "-v":
                ++verbose
                break
            case "--help":
            case "-h":
                printHelp()
                process.exit(0)
            default:
                if (process.argv[i].length > 0 && process.argv[i].charAt(0) == "-") {
                    console.log(`corba-idl: error: unrecognized command line option '${process.argv[i]}'`)
                    process.exit(1)
                }
                break argloop
        }
    }
    if (i === process.argv.length) {
        console.log("corba-idl: no input files")
        process.exit(1)
    }
    return i
}

function setupFilenameVars(idlFilename: string): void {
    // a/b/c.idl
    // filename = a/b/c.idl
    // used in comment from which idl the output was created
    setFilename(idlFilename)
    let n

    // filenamePrefix = a/b/c
    // use to create the output file
    n = filename.lastIndexOf(".")
    if (n === -1) {
        console.log(`corba-idl: error: filename '${filename}' must at least contain one dot ('.')`)
        process.exit(1)
    }
    if (outputDirectory) {
        fs.mkdirSync(outputDirectory, { recursive: true });

        if (outputDirectory.charAt(outputDirectory.length - 1) !== "/")
            outputDirectory += "/"
        let noSuffix = filename.substr(0, n)
        n = noSuffix.lastIndexOf("/")
        if (n === -1)
            setFilenamePrefix(outputDirectory + noSuffix)

        else
            setFilenamePrefix(outputDirectory + noSuffix.substr(n + 1))
    } else {
        setFilenamePrefix(filename.substr(0, n))
    }

    // filenameLocal = a/b
    // used in the output file to inclue another output file
    n = filenamePrefix.lastIndexOf("/")
    if (n === -1)
        setFilenameLocal(filenamePrefix)

    else
        setFilenameLocal(filenamePrefix.substr(n + 1))
}

function parseIDLFile(): Node {
    let filedata: string
    try {
        filedata = fs.readFileSync(filename, "utf8")
    }
    catch (error) {
        if (error instanceof Error)
            console.log(`corba-idl: error: failed to read file '${filename}': ${error.message}`)

        else
            console.log(error)
        process.exit(1)
    }

    let lexer = new Lexer(filedata)
    let syntaxTree: Node | undefined
    try {
        syntaxTree = specification(lexer)
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(`corba-idl: error: ${error.message} in file '${filename}' at line ${lexer.line}, column ${lexer.column}`)
            if (verbose)
                console.log(error.stack)
        } else {
            console.log(error)
        }
        process.exit(1)
    }
    if (syntaxTree === undefined) {
        console.log("corba-idl: error: empty file or unexpected internal failure")
        process.exit(1)
    }
    return syntaxTree
}

function createOutputFiles(syntaxTree: Node): void {
    try {
        if (tsInterface) {
            writeTSInterface(syntaxTree!)
        }
        if (tsSkeleton) {
            writeTSSkeleton(syntaxTree!)
        }
        if (tsStub) {
            writeTSStub(syntaxTree!)
        }
        if (tsValueType) {
            writeTSValue(syntaxTree!)
            writeTSValueType(syntaxTree!)
        }
        if (tsValueImpl) {
            writeTSValueImpl(syntaxTree!)
        }

        if (ccInterface) {
            writeCCInterface(syntaxTree!)
        }
        if (ccSkeleton) {
            writeCCSkeleton(syntaxTree!)
        }
        if (ccStub) {
            writeCCStub(syntaxTree!)
        }
        if (ccCode) {
            writeCCCode(syntaxTree!)
        }
        // if (ccValueType) {
        //     writeCCValue(syntaxTree!)
        //     writeCCValueType(syntaxTree!)
        // }
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(`corba-idl: error: ${error.message} in file '${filename}'`)
            if (verbose)
                console.log(error.stack)
        } else {
            console.log(error)
        }
        process.exit(1)
    }
}
