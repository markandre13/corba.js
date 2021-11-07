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

// ASN.1 DER Encoding for CSIv2's GSS requirements

export class ASN1Tag extends Object {
    tagClass!: number
    tag!: number
    encoding!: number
    length!: number
    constructor()
    constructor(tagClass: number, tag: number, encoding: number, length: number)
    constructor(tagClass?: number, tag?: number, encoding?: number, length?: number) {
        super()
        this.tagClass = tagClass!
        this.encoding = encoding!
        this.tag = tag!
        this.length = length!
    }
    override toString() {
        if (this.tagClass === ASN1Class.UNIVERSAL)
            return `ASN1Tag(class=${ASN1Class[this.tagClass]}, encoding=${ASN1Encoding[this.encoding]}, tag=${ASN1UniversalTag[this.tag]}, length=${this.length})`
        else
            return `ASN1Tag(class=${ASN1Class[this.tagClass]}, encoding=${ASN1Encoding[this.encoding]}, tag=${this.tag}, length=${this.length})` 
    }
}

export enum ASN1Encoding {
    PRIMITIVE,
    CONSTRUCTED
};

export enum ASN1Class {
    UNIVERSAL = 0,
    APPLICATION,
    CONTEXT,
    PRIVATE
};

export enum ASN1UniversalTag {
    EOC = 0,
    BOOLEAN,
    INTEGER,
    BITSTRING,
    OCTETSTRING,
    NULLTAG,
    OID,
    OBJDESCRIPTOR,
    EXTERNAL,
    REAL,
    ENUMERATED,
    EMBEDDED_PDV,
    UTF8STRING,
    SEQUENCE = 16,
    SET,
    NUMERICSTRING,
    PRINTABLESTRING,
    T61STRING,
    VIDEOTEXSTRING,
    IA5STRING,
    UTCTIME,
    GENERALIZEDTIME,
    GRAPHICSTRING,
    VISIBLESTRING,
    GENERALSTRING,
    UNIVERSALSTRING,
    BMPSTRING
}
