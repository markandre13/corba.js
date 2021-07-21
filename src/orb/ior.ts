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

import { GIOPDecoder, GIOPBase } from "./giop"

// ORB::object_to_string
// ORB::string_to_object
// Example IOR:
//
// 0000 01 00 00 00 0f 00 00 00 49 44 4c 3a 53 65 72 76 ........IDL:Serv
//      ^           ^           ^
//      |           |           OID: IDL:Server:1.0
//      |           len
//      byte order
// 0010 65 72 3a 31 2e 30 00 00 02 00 00 00 00 00 00 00 er:1.0..........
//                              ^           ^
//                              |           tag id: TAG_INTERNET_IOP (9.7.2 IIOP IOR Profiles)
//                              sequence length
// 0020 2b 00 00 00 01 01 00 00 0a 00 00 00 31 32 37 2e +...........127.
//      ^           ^           ^           ^
//      |           |           |           host
//      |           |           len
//      |           iiop version major/minor
//      tag length
// 0030 30 2e 31 2e 31 00 65 9c 13 00 00 00 2f 32 35 35 0.1.1.e...../255
//                        ^     ^           ^
//                        |     |           object key
//                        |     len
//                        port
// 0040 31 2f 31 35 32 34 38 39 35 31 36 38 2f 5f 30 00 1/1524895168/_0.
//
// 0050 01 00 00 00 24 00 00 00 01 00 00 00 01 00 00 00 ....$...........
//      ^           ^           ^           ^
//      |           |           |           component TAG_CODE_SETS ?
//      |           |           seq length?
//      |           tag length
//      tag id: TAG_MULTIPLE_COMPONENTS
// 0060 01 00 00 00 14 00 00 00 01 00 00 00 01 00 01 00 ................
//      ^           ^
//      |           len?
//      native code set?
// 0070 00 00 00 00 09 01 01 00 00 00 00 00             ............
export class IOR {

    static TAG_INTERNET_IOP = 0;
    static TAG_MULTIPLE_COMPONENTS = 1;
    static TAG_SCCP_IOP = 2;
    static TAG_UIPMC = 3;
    static TAG_MOBILE_TERMINAL_IOP = 4;

    host?: string
    port?: number
    objectKey?: string

    constructor(ior: string) {
        if (ior.substr(0, 4) != "IOR:")
            throw Error(`Missing "IOR:" prefix in "${ior}"`)
        if (ior.length & 1)
            throw Error(`IOR has a wrong length.`)

        const buffer = new ArrayBuffer((ior.length - 4) / 2)
        const bytes = new Uint8Array(buffer)
        for (let i = 4, j = 0; i < ior.length; i += 2, ++j) {
            bytes[j] = Number.parseInt(ior.substr(i, 2), 16)
        }

        // hexdump(bytes)
        const decoder = new GIOPDecoder(buffer)

        const byteOrder = decoder.byte()
        decoder.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE

        const oid = decoder.string()
        if (oid !== "IDL:Server:1.0") {
            throw Error(`Unsupported OID '${oid}'. Currently only 'IDL:Server:1.0' is implemented.`)
        }

        const tagCount = decoder.dword()
        // console.log(`oid: '${oid}', tag count=${tagCount}`)
        for (let i = 0; i < tagCount; ++i) {
            const tagType = decoder.dword()
            const tagLength = decoder.dword()
            const tagStart = decoder.offset

            switch (tagType) {
                // 9.7.2 IIOP IOR Profiles
                case IOR.TAG_INTERNET_IOP: {
                    const iiopMajorVersion = decoder.byte()
                    const iiopMinorVersion = decoder.byte()
                    if (iiopMajorVersion !== GIOPBase.MAJOR_VERSION &&
                        iiopMinorVersion !== GIOPBase.MINOR_VERSION) {
                        throw Error(`Unsupported IIOP ${iiopMajorVersion}.${iiopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
                    }
                    this.host = decoder.string()
                    this.port = decoder.word()
                    this.objectKey = decoder.blob()
                    // console.log(`IIOP ${iiopMajorVersion}.${iiopMinorVersion} ${this.host}:${this.port} ${this.objectKey}`)
                } break
                // case IOR.TAG_MULTIPLE_COMPONENTS: {
                //     console.log(`Multiple Components`)
                //     const count = decoder.dword()
                //     console.log(`${count} components`)
                // } break
                // default:
                //     console.log(`Unhandled tag type=${tagType}`)
            }
            // const unread = tagLength - (decoder.offset - tagStart)
            // if (unread > 0)
            //     console.log(`note: ${unread} bytes at end of tag`)
            decoder.offset = tagStart + tagLength
        }
    }
}
