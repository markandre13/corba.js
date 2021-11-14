import { GIOPDecoder, GIOPEncoder } from "corba.js"
import { ASN1Tag, ASN1Class, ASN1Encoding, ASN1UniversalTag } from "corba.js/orb/asn1"
import { hexdump, parseHexDump } from "../util"
import { expect } from "chai"

describe("ASN.1", function () {
    const data = parseHexDump(
        `0000 60 28 06 06 67 81 02 01 01 01 00 00 00 00 00 00 .(..g...........
        0010 00 08 74 65 73 74 55 73 65 72 00 00 00 08 74 65 ..testUser....te
        0020 73 74 50 61 73 73 00 00 00 00                   stPass....`)

    it("decode", function () {
        // [IETF RFC 2743] 3.1, “Mechanism-Independent Token Format,” pp. 81-82.
        // { iso-itu-t (2) international-organization (23) omg (130) security (1) authentication (1) gssup-mechanism (1) }
        const decoder = new GIOPDecoder(data.buffer)

        const t0 = decoder.asn1tag()
        expect(t0).to.deep.equal(new ASN1Tag(ASN1Class.APPLICATION, 0, ASN1Encoding.CONSTRUCTED, 40))

        const t1 = decoder.asn1tag()
        expect(t1).to.deep.equal(new ASN1Tag(ASN1Class.UNIVERSAL, ASN1UniversalTag.OID, ASN1Encoding.PRIMITIVE, 6))

        console.log(t1.toString())
        const oid = decoder.asn1oid(t1.length)
        expect(oid).to.deep.equal([2, 23, 130, 1, 1, 1])

        const cdr = new GIOPDecoder(decoder.buffer.slice(decoder.offset))
        cdr.endian()
        const te = new TextDecoder()
        const user = te.decode(cdr.blob())
        const password = te.decode(cdr.blob())
        const realm = te.decode(cdr.blob())
        expect(user).to.equal("testUser")
        expect(password).to.equal("testPass")
        expect(realm).to.equal("")
        expect(decoder.offset).to.equal(10)
    })

    it("encode", function () {
        const encoder = new GIOPEncoder()
        encoder.asn1tag(ASN1Class.APPLICATION, 0, ASN1Encoding.CONSTRUCTED, function(encoder) {
            encoder.asn1tag(ASN1Class.UNIVERSAL, ASN1UniversalTag.OID, ASN1Encoding.PRIMITIVE, function(encoder) {
                encoder.asn1oid([2, 23, 130, 1, 1, 1])
            })
            encoder.endian()
            const te = new TextEncoder()
            encoder.blob(te.encode("testUser"))
            encoder.blob(te.encode("testPass"))
            encoder.blob(te.encode(""))   
        })
        // hexdump(encoder.bytes, 0, encoder.offset)
        // expect(data).to.deep.equal(encoder.bytes.slice(0, encoder.offset))

        const decoder = new GIOPDecoder(encoder.buffer.slice(0, encoder.offset))
        const t0 = decoder.asn1tag()
        expect(t0).to.deep.equal(new ASN1Tag(ASN1Class.APPLICATION, 0, ASN1Encoding.CONSTRUCTED, 40))

        const t1 = decoder.asn1tag()
        expect(t1).to.deep.equal(new ASN1Tag(ASN1Class.UNIVERSAL, ASN1UniversalTag.OID, ASN1Encoding.PRIMITIVE, 6))

        console.log(t1.toString())
        const oid = decoder.asn1oid(t1.length)
        expect(oid).to.deep.equal([2, 23, 130, 1, 1, 1])

        const cdr = new GIOPDecoder(decoder.buffer.slice(decoder.offset))
        cdr.endian()
        const te = new TextDecoder()
        const user = te.decode(cdr.blob())
        const password = te.decode(cdr.blob())
        const realm = te.decode(cdr.blob())
        expect(user).to.equal("testUser")
        expect(password).to.equal("testPass")
        expect(realm).to.equal("")
        expect(decoder.offset).to.equal(10)
    })

    describe("number", function () {
        const binary = new Uint8Array([0x2a, 0x7f, 0x81, 0x00, 0x88, 0x72, 0xa1, 0xb0, 0xbb, 0x00, 0x2a])
        it("encode", function() {
            const encoder = new GIOPEncoder()
            encoder.asn1number(42)
            encoder.asn1number(127)
            encoder.asn1number(128)
            encoder.asn1number(1138)
            encoder.asn1number(70000000)
            encoder.asn1number(42)
            // hexdump(encoder.bytes, 0, encoder.offset)
            expect(binary).to.deep.equal(encoder.bytes.slice(0, encoder.offset))
        })
        it("decode", function() {
            const decoder = new GIOPDecoder(binary.buffer)
            expect(decoder.asn1number()).to.equal(42)
            expect(decoder.asn1number()).to.equal(127)
            expect(decoder.asn1number()).to.equal(128)
            expect(decoder.asn1number()).to.equal(1138)
            expect(decoder.asn1number()).to.equal(70000000)
            expect(decoder.asn1number()).to.equal(42)
        })
    })
})