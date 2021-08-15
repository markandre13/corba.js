/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020 Mark-André Hopf <mhopf@mark13.org>
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
import { writeTSInterface } from "./write-interface"
import { writeTSSkeleton } from "./write-skeleton"
import { writeTSStub } from "./write-stub"
import { writeTSValue } from "./write-value"
import { writeTSValueType } from "./write-valuetype"
import { writeTSValueImpl } from "./write-valueimpl"
import { filenamePrefix, filename, setFilename, setFilenamePrefix, setFilenameLocal } from "./util"

function printHelp() {
    console.log(
        `corba.js IDL compiler
Copyright (C) 2018, 2020 Mark-André Hopf <mhopf@mark13.org>
This is free software; see the source for copying conditions.  There is
ABSOLUTELY NO WARRANTY; not even for MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.

Usage: corba-idl [options] file...
Options:
  --ts-all        create all TypeScript files
  --ts-interface  create TypeScript interface file for stub and skeleton
  --ts-stub       create TypeScript stub file
  --ts-skeleton   create TypeScript skeleton file
  --ts-valuetype  create TypeScript valuetype file
  --debug|-d      increase debug level
  --output-directory|-o <dir>
                  create files in <dir>
  --help|-h       this page
`)
}

let debug = 0,
    outputDirectory: string | undefined,
    tsInterface = false,
    tsStub = false,
    tsSkeleton = false,
    tsValueType = false,
    tsValueImpl = false

function main() {
    let i = parseArguments()
    for (; i < process.argv.length; ++i) {
        setupFilenameVars(process.argv[i])
        let syntaxTree = parseIDLFile()
        if (debug > 1)
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
            case "--output-directory":
            case "-o":
                outputDirectory = process.argv[++i]
                break
            case "--debug":
            case "-d":
                ++debug
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
            if (debug)
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
        if (tsInterface)
            writeTSInterface(syntaxTree!)
        if (tsSkeleton)
            writeTSSkeleton(syntaxTree!)
        if (tsStub)
            writeTSStub(syntaxTree!)
        if (tsValueType) {
            writeTSValue(syntaxTree!)
            writeTSValueType(syntaxTree!)
        }
        if (tsValueImpl)
            writeTSValueImpl(syntaxTree!)
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(`corba-idl: error: ${error.message} in file '${filename}'`)
            if (debug)
                console.log(error.stack)
        } else {
            console.log(error)
        }
        process.exit(1)
    }
}
