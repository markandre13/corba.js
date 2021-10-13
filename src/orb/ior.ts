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

import { GIOPDecoder } from "./giop"

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

// Interoperable Object Reference (IOR), CDR encoded
export class IOR {

    host: string
    port: number
    oid: string
    objectKey: Uint8Array

    constructor(ior: string) {
        // 7.6.9 Stringified Object References

        // Standard stringified IOR format
        if (ior.substr(0, 4).toUpperCase() != "IOR:")
            throw Error(`Missing "IOR:" prefix in "${ior}"`)

        // convert to binary
        if (ior.length & 1)
            throw Error(`IOR has a wrong length.`)
        const buffer = new Array<number>((ior.length - 4) / 2)
        for (let i = 4, j = 0; i < ior.length; i += 2, ++j) {
            buffer[j] = Number.parseInt(ior.substring(i, i+2), 16)
        }
        const bytes = new Uint8Array(buffer)
        const decoder = new GIOPDecoder(bytes.buffer)
        decoder.endian()
        const ref = decoder.reference()
        this.host = ref.host
        this.port = ref.port
        this.oid = ref.oid
        this.objectKey = ref.objectKey

        if (decoder.offset !== bytes.byteLength)
            console.log(`note: ${bytes.byteLength-decoder.offset} octets at end of IOR`)
    }
}

export namespace IOR {
    export namespace TAG {
        // CORBA 3.3 Part 2: 7.6.4 Standard IOR Profiles
        export enum IOR {
            INTERNET_IOP = 0,
            MULTIPLE_COMPONENTS = 1,
            SCCP_IOP = 2,
            UIPMC = 3,
            MOBILE_TERMINAL_IOP = 4
        }

        // CORBA 3.3 Part 2: 7.6.6 Standard IOP Components
        export enum ComponentId {
            ORB_TYPE = 0,
            CODE_SETS = 1,
            POLICIES = 2,
            ALTERNATE_IIOP_ADDRESS = 3,
            ASSOCIATION_OPTIONS = 13,
            SEC_NAME = 14,
            SPKM_1_SEC_MECH = 15,
            SPKM_2_SEC_MECH = 16,
            KerberosV5_SEC_MECH = 17,
            CSI_ECMA_Secret_SEC_MECH = 18,
            CSI_ECMA_Hybrid_SEC_MECH = 19,
            SSL_SEC_TRANS = 20,
            CSI_ECMA_Public_SEC_MECH = 21,
            GENERIC_SEC_MECH = 22,
            FIREWALL_TRANS = 23,
            SCCP_CONTACT_INFO = 24,
            JAVA_CODEBASE = 25,
            TRANSACTION_POLICY = 26,
            MESSAGE_ROUTERS = 30,
            OTS_POLICY = 31,
            INV_POLICY = 32,
            CSI_SEC_MECH_LIST = 33,
            NULL_TAG = 34,
            SECIOP_SEC_TRANS = 35,
            TLS_SEC_TRANS = 36,
            ACTIVITY_POLICY = 37,
            RMI_CUSTOM_MAX_STREAM_FORMAT = 38,
            GROUP = 39,
            GROUP_IIOP = 40,
            PASSTHRU_TRANS = 41,
            FIREWALL_PATH = 42,
            IIOP_SEC_TRANS = 43,
            INET_SEC_TRANS = 123
        }

        // CORBA 3.3 Part 2: 9.7.3 IIOP IOR Profile Components
        export enum IIOP {
            // since IIOP 1.1
            ORB_TYPE,
            CODE_SETS,
            SEC_NAME,
            ASSOCIATION_OPTIONS,
            TAG_GENERIC_SEC_MECH,
            TAG_SSL_SEC_TRANS,
            TAG_SPKM_1_SEC_MECH,
            TAG_SPKM_2_SEC_MECH,
            TAG_KerberosV5_SEC_MECH,
            TAG_CSI_ECMA_Secret_SEC_MECH,
            TAG_CSI_ECMA_Hybrid_SEC_MECH,
            TAG_SSL_SEC_TRANS_AGAIN,
            TAG_CSI_ECMA_Public_SEC_MECH,
            TAG_FIREWALL_TRANS,
            TAG_JAVA_CODEBASE,
            TAG_TRANSACTION_POLICY,
            TAG_MESSAGE_ROUTERS,
            TAG_INET_SEC_TRANS,
            // since IIOP 1.2
            TAG_ALTERNATE_IIOP_ADDRESS,
            TAG_POLICIES,
            TAG_DCE_STRING_BINDING,
            TAG_DCE_BINDING_NAME,
            TAG_DCE_NO_PIPES,
            TAG_DCE_MECH,
            TAG_COMPLETE_OBJECT_KEY,
            TAG_ENDPOINT_ID_POSITION,
            TAG_LOCATION_POLICY,
            TAG_OTS_POLICY,
            TAG_INV_POLICY,
            TAG_CSI_SEC_MECH_LIST,
            TAG_NULL_TAG,
            TAG_SECIOP_SEC_TRANS,
            TAG_TLS_SEC_TRANS,
            TAG_ACTIVITY_POLICY
        }
    }
}
