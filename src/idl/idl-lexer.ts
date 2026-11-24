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

import { Type, Token } from "./idl-node"

export const keywords = new Map<string, Type>([
    ["abstract", Type.TKN_ABSTRACT],
    ["any", Type.TKN_ANY],
    ["attribute", Type.TKN_ATTRIBUTE],
    ["boolean", Type.TKN_BOOLEAN],
    ["case", Type.TKN_CASE],
    ["char", Type.TKN_CHAR],
    ["component", Type.TKN_COMPONENT],
    ["const", Type.TKN_CONST],
    ["consumes", Type.TKN_CONSUMES],
    ["context", Type.TKN_CONTEXT],
    ["custom", Type.TKN_CUSTOM],
    ["default", Type.TKN_DEFAULT],
    ["double", Type.TKN_DOUBLE],
    ["exception", Type.TKN_EXCEPTION],
    ["emits", Type.TKN_EMITS],
    ["enum", Type.TKN_ENUM],
    ["eventtype", Type.TKN_EVENTTYPE],
    ["factory", Type.TKN_FACTORY],
    ["FALSE", Type.TKN_FALSE],
    ["finder", Type.TKN_FINDER],
    ["fixed", Type.TKN_FIXED],
    ["float", Type.TKN_FLOAT],
    ["getraises", Type.TKN_GETRAISES],
    ["home", Type.TKN_HOME],
    ["import", Type.TKN_IMPORT],
    ["in", Type.TKN_IN],
    ["inout", Type.TKN_INOUT],
    ["interface", Type.TKN_INTERFACE],
    ["local", Type.TKN_LOCAL],
    ["long", Type.TKN_LONG],
    ["module", Type.TKN_MODULE],
    ["multiple", Type.TKN_MULTIPLE],
    ["native", Type.TKN_NATIVE],
    ["Object", Type.TKN_OBJECT],
    ["octet", Type.TKN_OCTET],
    ["oneway", Type.TKN_ONEWAY],
    ["out", Type.TKN_OUT],
    ["primarykey", Type.TKN_PRIMARYKEY],
    ["private", Type.TKN_PRIVATE],
    ["provides", Type.TKN_PROVIDES],
    ["public", Type.TKN_PUBLIC],
    ["publishes", Type.TKN_PUBLISHES],
    ["raises", Type.TKN_RAISES],
    ["readonly", Type.TKN_READONLY],
    ["setraises", Type.TKN_SETRAISES],
    ["sequence", Type.TKN_SEQUENCE],
    ["short", Type.TKN_SHORT],
    ["string", Type.TKN_STRING],
    ["struct", Type.TKN_STRUCT],
    ["supports", Type.TKN_SUPPORTS],
    ["switch", Type.TKN_SWITCH],
    ["TRUE", Type.TKN_TRUE],
    ["truncatable", Type.TKN_TRUNCATABLE],
    ["typedef", Type.TKN_TYPEDEF],
    ["typeid", Type.TKN_TYPEID],
    ["typeprefix", Type.TKN_TYPEPREFIX],
    ["unsigned", Type.TKN_UNSIGNED],
    ["union", Type.TKN_UNION],
    ["uses", Type.TKN_USES],
    ["ValueBase", Type.TKN_VALUEBASE],
    ["valuetype", Type.TKN_VALUETYPE],
    ["void", Type.TKN_VOID],
    ["wchar", Type.TKN_WCHAR],
    ["wstring", Type.TKN_WSTRING]
])

// the spelling of a token as used in error messages
export function describeToken(token: Token | undefined): string {
    if (token === undefined)
        return "undefined"
    switch (token.type) {
        case Type.TKN_TEXT:        return `text '${token.text}'`
        case Type.TKN_IDENTIFIER:  return `identifier '${token.text}'`
        case Type.TKN_COLON_COLON: return "::"
        case Type.SYN_LONGLONG:               return "long long"
        case Type.SYN_UNSIGNED_SHORT:         return "unsigned short"
        case Type.SYN_UNSIGNED_LONG:          return "unsigned long"
        case Type.SYN_UNSIGNED_LONGLONG:      return "unsigned long long"
        case Type.SYN_LONG_DOUBLE:            return "long double"
    }
    for (const [text, type] of keywords) {
        if (type === token.type)
            return text
    }
    return Type[token.type]
}

export class Lexer {
    data: string
    line: number
    column: number
    
    pos: number
    state: number
    text?: string
    tokenStack: Array<Token>
    // documentation comment lines seen since the last token
    doc: string[] = []

    static isAlpha(c: string): boolean {
        let n = c.charCodeAt(0)
        return (
                 (0x41 <= n && n <= 0x5a) ||
                 (0x61 <= n && n <= 0x7a)
               )
    }

    static isDigit(c: string): boolean {
        let n = c.charCodeAt(0)
        return (0x30 <= n && n <= 0x39)
    }
    
    static isAlphaNumeric(c: string): boolean {
        return Lexer.isAlpha(c) || Lexer.isDigit(c)
    }

    constructor(data: string) {
        this.data = data
        this.line = 1
        this.column = 1
        this.pos = 0
        this.state = 0
        this.tokenStack = new Array<Token>()
    }
    
    eof(): boolean {
        return this.pos >= this.data.length
    }

    getc(): string {
        let c = this.data[this.pos++]
        if (c=='\n') {
            ++this.line
            this.column = 1
        } else {
            ++this.column // FIXME: tabulators
        }
        return c
    }
    
    ungetc(): void {
        let c = this.data[--this.pos]
        if (c=='\n') {
            let i
            for(i=this.pos; i>0; --i) {
                if (this.data[i] == '\n')
                    break
            }
            this.column = i
            --this.line
        } else {
            --this.column
        }
    }
    
    unlex(token: Token | undefined): void {
        if (token === undefined)
            return
        // FIXME: adjust this.line and this.column
        this.tokenStack.push(token)
    }
    
    lex(): Token | undefined {
        if (this.tokenStack.length > 0) {
            return this.tokenStack.pop()
        }
        const token = this.lexToken()
        if (token !== undefined && this.doc.length > 0) {
            token.doc = this.doc
            this.doc = []
        }
        return token
    }

    // doc comments are /** */, /*! */, /// and //! (doxygen and JSDoc style)
    collectDoc(comment: string): void {
        let lines: string[]
        if (comment.startsWith("///") && !comment.startsWith("////") || comment.startsWith("//!")) {
            lines = [comment.substring(3)]
        } else if (comment.startsWith("/**") || comment.startsWith("/*!")) {
            lines = comment.substring(3, comment.length - 1).split("\n")
        } else {
            return
        }
        lines = lines.map(line => line.replace(/^\s*\*?\s*/, "").trimEnd())
        while (lines.length > 0 && lines[0] === "")
            lines.shift()
        while (lines.length > 0 && lines[lines.length - 1] === "")
            lines.pop()
        this.doc.push(...lines)
    }

    private lexToken(): Token | undefined {
        while(!this.eof()) {
            let c = this.getc()
//console.log("state="+this.state+" c='"+c+"'")
            let oldstate = this.state
            switch(this.state) {
                case 0:
                    switch(c) {
                        case ' ':
                        case '\r':
                        case '\n':
                        case '\t':
                        case '\v':
                            break
                        case '/':
                            this.state = 3
                            break
                        case '_':
                            this.state = 1
                            this.text = ""
                            continue
                        case ':':
                            this.state = 7
                            break
                        // case '0':
                        //     this.state = ...
                        //     break
                        // case '1':
                        // case '2':
                        // case '3':
                        // case '4':
                        // case '5':
                        // case '6':
                        // case '7':
                        // case '8':
                        // case '9':
                        //     this.state = ...
                        //     break
                        default:
                            if (Lexer.isAlpha(c)) {
                                this.state = 2
                            } else {
                                return { type: Type.TKN_TEXT, text: c }
                            }
                            break
                    }
                    break
                case 1: // _<identifier> CORBA IDL style identifier escape
                    if (!Lexer.isAlpha(c)) {
                        this.ungetc()
                        this.state = 0
                        return { type: Type.TKN_IDENTIFIER, text: this.text }
                    }
                    break
                case 2: // <identifier>
                    if (!Lexer.isAlphaNumeric(c) && c!=="_") {
                        this.ungetc()
                        this.state = 0
                        const keyword = keywords.get(this.text!)
                        if (keyword !== undefined)
                            return { type: keyword }
                        return { type: Type.TKN_IDENTIFIER, text: this.text }
                    }
                    break
                case 3: // /...
                    switch(c) {
                        case '/':
                            this.state = 4
                            break
                        case '*':
                            this.state = 5
                            break
                        default:
                            this.ungetc()
                            return { type: Type.TKN_TEXT, text: '/' }
                    }
                    break
                case 4: // //...
                    switch(c) {
                        case '\n':
                            this.state = 0
                            this.collectDoc(this.text!)
                            break
                    }
                    break
                case 5: // /*...
                    switch(c) {
                        case '*':
                            this.state = 6
                            break
                    }
                    break
                case 6: // /*...*
                    switch(c) {
                        case '/':
                            this.state = 0
                            this.collectDoc(this.text!)
                            break
                        case '*':
                            break
                        default:
                            this.state = 5
                    }
                    break
                case 7: // :
                    this.state = 0
                    if (c == ':') {
                        return { type: Type.TKN_COLON_COLON, text: "::" }
                    } else {
                        this.ungetc()
                        return { type: Type.TKN_TEXT, text: ':' }
                    }
            }
            if (oldstate == 0) {
                this.text = c
            } else {
                this.text += c
            }
        }
        return undefined
    }
}
