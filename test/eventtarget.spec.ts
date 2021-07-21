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

import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"
import { mockConnection } from "./util"

describe("eventtarget", function() {
    describe("register and dispatch", async function() {
        it("eventListener", async function() {
            let flag = false
            let orb = new client.ORB()
            orb.addEventListener("close", {
                handleEvent: function() {
                    flag = true
                }
            })
            orb.dispatchEvent(new Event("close"))
            
            expect(flag).to.equal(true)
        })

        it("closure", async function() {
            let flag = false
            let orb = new client.ORB()
            orb.addEventListener("close", () => {
                flag = true
            })
            orb.dispatchEvent(new Event("close"))
            
            expect(flag).to.equal(true)
        })
    })
    
    describe("register and unregister", async function() {
        it("eventListener", async function() {
            let text = ""
        
            class Listener implements EventListenerObject {
                name: string
                constructor(instanceName: string) {
                    this.name = instanceName
                }
                handleEvent() {
                    text = text + ":" + this.name
                }
            }
            
            let a = new Listener("alfa")
            let b = new Listener("bravo")
            
            let orb = new client.ORB()
            orb.addEventListener("close", a)
            orb.addEventListener("close", b)
            
            text = ""
            orb.dispatchEvent(new Event("close"))
            expect(text).to.equal(":alfa:bravo")
            
            orb.removeEventListener("close", a)
            
            text = ""
            orb.dispatchEvent(new Event("close"))
            expect(text).to.equal(":bravo")
        })
    
        it("closure", async function() {
            let text = ""
        
            class Listener {
                name: string
                orb: client.ORB
                callback: Function
            
                constructor(instanceName: string, orb: client.ORB) {
                    this.name = instanceName
                    this.orb = orb
                    this.callback = () => {
                        text = text + ":" + this.name
                    }
                    this.orb.addEventListener("close", this.callback as EventListener)
                }
                destructor() {
                    this.orb.removeEventListener("close", this.callback as EventListener)
                }
            }
    
            let orb = new client.ORB()
            let a = new Listener("alfa", orb)
            let b = new Listener("bravo", orb)
            
            text = ""
            orb.dispatchEvent(new Event("close"))
            expect(text).to.equal(":alfa:bravo")
            
            a.destructor()
            
            text = ""
            orb.dispatchEvent(new Event("close"))
            expect(text).to.equal(":bravo")
        })
    })
    
    it("onclose", async function() {
        let flagA = false
        let flagB = false
        let orb = new client.ORB()
        orb.onclose = () => {
            flagA = true
        }
        orb.onclose = () => {
            flagB = true
        }
        orb.dispatchEvent(new Event("close"))
        expect(flagA).to.equal(false)
        expect(flagB).to.equal(true)
    })
})
