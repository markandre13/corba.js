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

import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"

export function mockConnection(serverORB: server.ORB, clientORB: client.ORB): server.ORB {
    let acceptedORB = new server.ORB(serverORB)

    acceptedORB.socket = {
        send: function(data: any) {
            clientORB.socket!.onmessage({data:data} as any)
        }
    } as any
    acceptedORB.accept()
    clientORB.socket = {
        send: function(data: any) {
            acceptedORB.socket!.onmessage({data:data} as any)
        }
    } as any
    return acceptedORB
}

