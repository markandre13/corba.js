const typescript = require("typescript")
const path = require("path")
const { existsSync } = require("fs")
const { normalize } = require("path")
// import * as typescript from 'typescript'
// import * as path from 'path'
// import { existsSync } from 'fs'
// import { normalize } from 'path'

// this transformer applies the baseUrl & paths rules from the tsconfig.json file
// and appends .js to imports/exports, so that the typescript compiler's output
// can be used directly in ES6 module workflows without additional bundlers

// how TypeScript's rootDirs, baseUrl & paths work is documented in the TypeScript
// source in src/compiler/moduleNameResolver.ts as follows:
// * if a baseUrl is given, then absolute paths will be prefixed with the baseUrl
// * "paths": { PATTERN: [SUBSTITUTION, ...], ...  }
// * PATTERN and SUBSTITUTION can have 0-1 '*' (which means that we can just split at '*')
// * if multiple patterns match, match with the longest prefix is choosen
// * the * in PATTERN is to be replaced with the * in SUBSTITUTION

const transformer = (program) => (transformationContext) => (sourceFile) => {

    function transformAST(node) {

        if (isImportExportDeclaration(node)) {

            const compilerOptions = program.getCompilerOptions()

            if (compilerOptions.baseUrl &&
                !node.moduleSpecifier.text.startsWith('.')
            ) {
                let newModuleName = resolveBaseUrlAndPath(program, node)
                if (newModuleName !== undefined) {
                    if (!newModuleName.endsWith(".js")) {
                        newModuleName += ".js"
                    }
                    const newModuleSpecifier = typescript.factory.createStringLiteral(newModuleName)
                    if (typescript.isImportDeclaration(node)) {
                        return typescript.factory.updateImportDeclaration(node, node.modifiers, node.importClause, newModuleSpecifier, node.assertClause)
                    } else if (typescript.isExportDeclaration(node)) {
                        return typescript.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, newModuleSpecifier, node.assertClause)
                    }
                }
            }

            if (shouldMutateModuleSpecifier(node)) {
                const newModuleSpecifier = typescript.factory.createStringLiteral(`${node.moduleSpecifier.text}.js`)
                if (typescript.isImportDeclaration(node)) {
                    return typescript.factory.updateImportDeclaration(node, node.modifiers, node.importClause, newModuleSpecifier, node.assertClause)
                } else if (typescript.isExportDeclaration(node)) {
                    return typescript.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, newModuleSpecifier, node.assertClause)
                }
            }
        }

        return typescript.visitEachChild(node, transformAST, transformationContext)
    }

    function isImportExportDeclaration(node) {
        return (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node))
            && node.moduleSpecifier !== undefined
            && typescript.isStringLiteral(node.moduleSpecifier)
    }

    function shouldMutateModuleSpecifier(node) {
        // only when path is relative
        if (!node.moduleSpecifier.text.startsWith('./') &&
            !node.moduleSpecifier.text.startsWith('../')) {
            return false
        }
        // only when module specifier has no extension
        if (path.extname(node.moduleSpecifier.text) !== '') {
            return false
        }
        return true
    }

    return typescript.visitNode(sourceFile, transformAST)
}

function resolveBaseUrlAndPath(program, node) {
    let moduleName = node.moduleSpecifier.text
    const compilerOptions = program.getCompilerOptions()
    if (compilerOptions?.baseUrl == undefined) {
        return undefined
    }

    let filename = (node?.parent?.fileName) ?? node?.original?.parent?.fileName
    if (filename === undefined) {
        return
    }

    if (filename.startsWith(compilerOptions.baseUrl)) {
       
        for (let adjustedModuleName of tsPathResolver(compilerOptions, moduleName)) {
            let found = false
            for (let ext of ["ts", "tsx", "js", "jsx"]) {
                const absoluteModuleName = normalize(`${compilerOptions.baseUrl}/${adjustedModuleName}.${ext}`)
                if (existsSync(`${absoluteModuleName}`)) {
                    found = true
                    break
                }
            }
            if (!found) {
                continue
            }

            const relativeModuleName = fromToFile(filename.substring(compilerOptions.baseUrl.length + 1), adjustedModuleName)
            return relativeModuleName
        }
    }
}

function tsPathResolver(config, moduleName) {
    if (config.baseUrl === undefined || config.paths === undefined) {
        return [moduleName]
    }
    if (moduleName.charAt(0) == ".") {
        return [moduleName]
    }

    // find the best pattern
    let bestPattern
    let bestPatternsHeadLength = 0

    for (let pattern in config.paths) {
        const asterisk = pattern.indexOf("*")
        if (asterisk !== -1) {
            const pathHead = pattern.substring(0, asterisk)
            const pathTail = pattern.substring(asterisk + 1)
            if (pathHead.length > bestPatternsHeadLength &&
                moduleName.startsWith(pathHead) &&
                moduleName.endsWith(pathTail)
            ) {
                bestPatternsHeadLength = pathHead.length
                bestPattern = pattern
            }
        } else {
            if (pattern.length >= bestPatternsHeadLength &&
                pattern === moduleName
            ) {
                bestPatternsHeadLength = pattern.length
                bestPattern = moduleName
            }
        }
    }

    // apply the best pattern's substitutions
    if (bestPattern !== undefined) {
        const asterisk = bestPattern.indexOf("*")
        if (asterisk !== -1) {
            const pathTail = bestPattern.substring(asterisk + 1)
            const middle = moduleName.substring(asterisk, moduleName.length - pathTail.length)
            const substitutions = config.paths[bestPattern]
            return substitutions.map(substitution => {
                const subAsterisk = substitution.indexOf("*")
                const subHead = substitution.substring(0, subAsterisk)
                const subTail = substitution.substring(subAsterisk + 1)
                return `${subHead}${middle}${subTail}`
            })
        } else {
            return config.paths[bestPattern]
        }
    }
    return [moduleName]
}

function fromToFile(fromFile, toFile) {
    const fromFileParts = fromFile.split("/")
    const toFileParts = toFile.split("/")

    const maxDepth = Math.min(fromFileParts.length, toFileParts.length)
    let equalUntilDepth = 0
    while (equalUntilDepth < maxDepth && fromFileParts[equalUntilDepth] == toFileParts[equalUntilDepth]) {
        ++equalUntilDepth
    }

    let relativeModuleName = "../".repeat(fromFileParts.length - equalUntilDepth - 1) // -1 is the file itself
    if (relativeModuleName.length == 0) {
        relativeModuleName = "./"
    }

    for (; equalUntilDepth < toFileParts.length; ++equalUntilDepth) {
        relativeModuleName += toFileParts[equalUntilDepth] + "/"
    }
    return relativeModuleName = relativeModuleName.substring(0, relativeModuleName.length - 1) // strip last "/"
}
 
module.exports = transformer
