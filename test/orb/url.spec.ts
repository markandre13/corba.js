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

import { expect } from "chai"
import { UrlParser, UrlLexer } from "corba.js/orb/url"

// Corba 3.4 Part 2, 7.6.10 Object URLs
// TODO: catch illegal input
// [ ] trailing '-' in hostname label
// [ ] illegal IPv6, for now we just copy everything until ']'
// [ ] the IPv6 notation "[...]" is used in URLs, but does it work within corba.js?
// [ ] when RIR is used, reject other protocols (as per CORBA spec)
// ...
describe("URL", async function () {
    describe("UrlLexer", function () {
        describe("number()", function () {
            it("returns a number on success", function () {
                const url = new UrlLexer("123a")
                expect(url.number()).to.equal(123)
                expect(url.pos).to.equal(3)
            })
            it("returns undefined on failure", function () {
                const url = new UrlLexer("a123")
                expect(url.number()).to.be.undefined
                expect(url.pos).to.equal(0)
            })
        })
        describe("match(string)", function () {
            it("is a match", function () {
                const url = new UrlLexer("foobar")
                expect(url.match("foo")).to.equal("foo")
                expect(url.pos).to.equal(3)
            })
            it("is a match till end of url", function () {
                const url = new UrlLexer("foo")
                expect(url.match("foo")).to.equal("foo")
                expect(url.pos).to.equal(3)
            })
            it("is no match", function () {
                const url = new UrlLexer("foobar")
                expect(url.match("fu")).to.be.undefined
                expect(url.pos).to.equal(0)
            })
            it("is no match after end of url", function () {
                const url = new UrlLexer("foobar")
                expect(url.match("foobart")).to.be.undefined
                expect(url.pos).to.equal(0)
            })
        })
    })
    describe("UrlParser", function () {
        describe("corbaloc", function () {
            describe("iiop", function () {
                it("with three hosts", function () {
                    const parser = new UrlParser(
                        "corbaloc:iiop:1.1@mark-13.org:8080,iiop:1.2@mhsd.de:4040,:dawnrazor.co.uk/Prod/TradingService"
                    )
                    expect(parser.parse()?.toString()).to.equal(
                        "corbaloc:iiop:1.1@mark-13.org:8080,iiop:1.2@mhsd.de:4040,iiop:1.0@dawnrazor.co.uk:2809/Prod/TradingService"
                    )
                })
                it("defaults", function () {
                    const parser = new UrlParser("corbaloc::mark13.org/Prod/TradingService")
                    expect(parser.parse()?.toString()).to.equal("corbaloc:iiop:1.0@mark13.org:2809/Prod/TradingService")
                })
                it("IPv4", function () {
                    const parser = new UrlParser("corbaloc::127.0.0.1/Prod/TradingService")
                    expect(parser.parse()?.toString()).to.equal("corbaloc:iiop:1.0@127.0.0.1:2809/Prod/TradingService")
                })
                it("IPv6", function () {
                    const parser = new UrlParser("corbaloc::[1080::8:800:200C:417A]/Prod/TradingService")
                    expect(parser.parse()?.toString()).to.equal(
                        "corbaloc:iiop:1.0@[1080::8:800:200C:417A]:2809/Prod/TradingService"
                    )
                })
            })
            describe("rir", function () {
                it("rir", function () {
                    const parser = new UrlParser("corbaloc:rir:/NameService")
                    expect(parser.parse()?.toString()).to.equal("corbaloc:rir:/NameService")
                })
            })
        })

        describe("corbaname", function () {
            it("iiop", function () {
                const parser = new UrlParser("corbaname::555objs.com#a/string/path/to/obj")
                expect(parser.parse()?.toString()).to.equal(
                    "corbaname:iiop:1.0@555objs.com:2809/NameService#a/string/path/to/obj"
                )
            })
            it("rir", function () {
                const parser = new UrlParser("corbaname:rir:#a/local/obj")
                expect(parser.parse()?.toString()).to.equal("corbaname:rir:/NameService#a/local/obj")
            })
        })
    })
})
