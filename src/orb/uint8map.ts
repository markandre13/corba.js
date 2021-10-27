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

export class Uint8Map<V> {
    private static byteToHex = new Array<string>(0xff);
    private map = new Map<string, V>();

    set(key: Uint8Array, value: V): Uint8Map<V> {
        this.map.set(Uint8Map.hex(key), value)
        return this
    }
    delete(key: Uint8Array): boolean {
        return this.map.delete(Uint8Map.hex(key))
    }
    get(key: Uint8Array): V | undefined {
        return this.map.get(Uint8Map.hex(key))
    }
    has(key: Uint8Array): boolean {
        return this.map.has(Uint8Map.hex(key))
    }
    get size(): number {
        return this.map.size
    }

    static hex(buffer: Uint8Array) {
        let hexOctets = ""
        for (let i = 0; i < buffer.length; ++i)
            hexOctets += Uint8Map.byteToHex[buffer[i]]
        return hexOctets
    }

    private static init = (function () {
        for (let n = 0; n <= 0xff; ++n) {
            const hexOctet = n.toString(16).padStart(2, "0")
            Uint8Map.byteToHex[n] = hexOctet
        }
    })();
}
