/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2021 Mark-André Hopf <mhopf@mark13.org>
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

import { IOR } from "./ior"

export class CorbaLocation extends Object {
    addr:ObjectAddress[] = []
    objectKey?: string

    override toString() {
        return "corbaloc:" + this.toStringCore()
    }

    toStringCore() {
        let txt = ""
        for(let i=0; i<this.addr.length; ++i) {
            if (i!==0)
                txt += ","
            const a = this.addr[i]
            switch(a.proto) {
                case "iiop":
                    txt += `${a.proto}:${a.major}.${a.minor}@${a.host}:${a.port}`
                    break
                case "rir":
                    txt += "rir:"
                    break
            }
        }
        if (this.objectKey !== undefined)
            txt += "/" + this.objectKey
        return txt
    }
}

export class CorbaName extends CorbaLocation {
    name: string = ""
    constructor() {
        super()
        this.objectKey = "NameService"
    }
    override toString() {
        let txt = "corbaname:"
        txt += this.toStringCore()
        if (this.name !== undefined)
            txt += "#" + this.name
        return txt
    }
}

export class ObjectAddress {
    proto = "iiop"
    major = 1
    minor = 0
    host = ""
    port = 2809
}

export class UrlParser {
    url: UrlLexer
    loc!: CorbaLocation
    addr!: ObjectAddress

    constructor(url: string) {
        this.url = new UrlLexer(url)
    }

    parse() {
        if (this.url.match("IOR:")) {
            return new IOR(this.url.data)
        }
        if (this.url.match("corbaloc:")) {
            this.loc = new CorbaLocation()
            return this.corbaloc()
        }
        if (this.url.match("corbaname:")) {
            return this.corbaname()
        }
        throw Error(`Bad string, expected on of 'IOR:...', 'corbaloc:...' or 'corbaname:...'`)
    }

    corbaname() {
        const name = new CorbaName()
        this.loc = name
        this.corbaloc()
        if (this.url.match("#")) {
            const uri = this.url.uri()
            if (uri !== undefined)
                name.name = uri
        }
        return name
    }

    corbaloc() {
        this.obj_addr_list()
        if (this.url.match("/")) {
            const keyString = this.key_string()
            // TODO: handle RFC 2396 escapes!!!
            // console.log(`key string "${keyString}"`)
            this.loc.objectKey = keyString
        }
        return this.loc
    }

    obj_addr_list() {
        do {
            this.addr = new ObjectAddress()
            this.obj_addr()
            this.loc.addr.push(this.addr)
        } while(this.url.match(","))
    }

    obj_addr() {
        this.prot_addr()
    }
    
    prot_addr() {
        if (this.rir_prot_addr())
            return true
        if (this.iiop_prot_addr())
            return true
    }

    rir_prot_addr() {
        if (this.url.match("rir:")) {
            this.addr.proto = "rir"
        }
        return false
    }

    iiop_prot_addr() {
        if (!this.iiop_id())
            return false
        this.iiop_addr()
        return true
    }

    iiop_id() {
        if (this.url.match("iiop:"))
            return true
        if (this.url.match(":"))
            return true
        return false
    }

    iiop_addr() {
        this.version()
        this.host()
        if (this.url.match(":")) {
            const port = this.port()
            if (port === undefined) {
                throw Error(`missing port number after :`)
            }
            this.addr.port = port
        }
    }

    version() {
        const start = this.url.pos
        const major = this.url.number()
        if (major === undefined)
            return undefined
        if (this.url.match(".") === undefined) {
            this.url.pos = start
            return undefined
        }
        const minor = this.url.number()
        if (minor === undefined) {
            this.url.pos = start
            return undefined
        }
        if (this.url.match("@") === undefined) {
            this.url.pos = start
            return undefined
        }
        this.addr.major = major
        this.addr.minor = minor
        // console.log(`version ${major}.${minor}`)
    }

    // host, IPv4, IPv6
    host() {
        const start = this.url.pos

        if (this.url.match("[")) {
            const end = this.url.data.indexOf("]", start)
            if (end === -1)
                throw Error(`missing ] in IPv6 address`)
            this.addr.host = this.url.data.substring(start, end)
            this.url.pos = end + 1
        }

        do {
            this.label()
        } while(this.url.match("."))
        if (start == this.url.pos)
            return undefined
        const host = this.url.data.substring(start, this.url.pos)
        this.addr.host = host
        return host
    }

    label() {
        let c = this.url.getc()
        if (!UrlLexer.isAlphaNumeric(c)) {
            this.url.ungetc()
            return false
        }

        do {
            c = this.url.getc()
        } while (UrlLexer.isAlphaNumeric(c) || c == "-")
        this.url.ungetc()
        return true
    }

    port() {
        return this.url.number()
    }

    key_string() {
        return this.url.uri()
    }

}

class UrlLexer {
    data: string
    pos = 0
    state = 0

    constructor(url: string) {
        this.data = url
    }

    match(s: string): string | undefined {
        if (this.pos + s.length > this.data.length) {
            return undefined
        }
        if (this.data.substring(this.pos, this.pos+s.length) != s) {
            return undefined
        }
        this.pos += s.length
        return s
    }

    number(): number | undefined {
        const start = this.pos
        while(UrlLexer.isDigit(this.getc())) {}
        this.ungetc()
        if (start === this.pos)
            return undefined
        return parseInt(this.data.substring(start, this.pos))
    }

    uri(): string | undefined {
        const start = this.pos
        while(!this.eof()) {
            let c = this.getc()
            if (!UrlLexer.isAlphaNumeric(c) && "%;/:?:@&=+$,-_!~*’|()".indexOf(c) === -1) {
                this.ungetc()
                break
            }
        }
        if (this.pos === start)
            return undefined
        return decodeURI(this.data.substring(start, this.pos))
    }

    eof(): boolean {
        return this.pos >= this.data.length
    }

    getc(): string {
        return this.data[this.pos++]
    }
    
    ungetc(): void {
        --this.pos
    }

    // copied from lexer
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
        return UrlLexer.isAlpha(c) || UrlLexer.isDigit(c)
    }
}
