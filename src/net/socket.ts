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

import { ORB } from "corba.js"
import { Socket } from "net"

export function connect(orb: ORB, host: string, port: number): Promise<Socket> {
    return new Promise<Socket>((resolve, reject) => {
        const socket = new Socket()
        socket.on("error", (error: Error) => orb.socketError(error))
        socket.on("close", (hadError: boolean) => orb.socketClose())
        socket.on("data", (data: Buffer) => orb.socketRcvd(data.buffer))
        orb.socketSend = (buffer: ArrayBuffer) => {
            socket.write(new Uint8Array(buffer))
        }
        socket.connect(port, host, () => resolve(socket))
    })
}
