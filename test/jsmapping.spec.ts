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

import { JsMapping as JsMapping_skel } from "./generated/jsmapping_skel"

class JsMapping_impl extends JsMapping_skel {
    override arrayIn(value: Array<number>): Promise<void> {
        throw new Error("Method not implemented.")
    }
    override typedArrayIn(value: Float32Array): Promise<void> {
        throw new Error("Method not implemented.")
    }
    override arrayOut(): Promise<Array<number>> {
        throw new Error("Method not implemented.")
    }
    override typeArrayOut(): Promise<Float32Array> {
        throw new Error("Method not implemented.")
    }
    override attr(): Promise<Float32Array>
    override attr(value: Float32Array): Promise<void>
    override attr(value?: Float32Array): Promise<void | Float32Array> {
        throw new Error("Method not implemented.")
    }

    override typedAttr(): Promise<Float32Array>
    override typedAttr(value: Float32Array): Promise<void>
    override typedAttr(value?: Float32Array): Promise<void | Float32Array> {
        throw new Error("Method not implemented.")
    }
}

// describe("js_mapping", function () {
//     it.only("get value", function () {
//     })
// })
