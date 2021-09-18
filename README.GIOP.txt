NOTES ON CORBA'S binary General Inter-ORB Protocol (GIOP)

GIOP FEATURES

GIOP
* is a binary format
* can handle multiple pointers to the same object
  in case the object has been stored before, a relative offset will point to the previous definition
* can handle multiple occurences of id strings
  in case the string has been stored before, a relative offset will point to the previous definition

CORBA TERMS

  GIOP (General Inter-ORB Protocol)
  IIOP (Internet Inter-ORB Protocol)
  IOR (Interoperable Object Reference)
  RepositoryID ID to identify valuetypes
  CDR (Common Type Representation)
  BOA (Basic Object Adapter)
  POA (Portable Object Adapter, replaced BOA since CORBA 2.2)

CORBA 3.3, 9.3.4 Value Types

CORBA 3.3, Part II: 9.4.9 Fragment Message, 9.3.4.5 Fragmentation
* added in GIOP 1.1
* when a Request or Reply Message had the 'more fragments bit' set to true,
  it fill be followed by one or more Fragment messages, with the last one
  having it's 'more frament bit' set to false.
* a CancelRequest can tell the peer to stop sending fragments
* data in the fragment is aligned to its position within the fragment,
  no the whole message

fair enough, now the sucky Part: 9.3.4.5 Fragmentation
it seems that the 'more fragments bit' is neither in the GIOP nor the
Request or Reply header but instead in the value_tag & 0x08

if set, there's an ulong for the length of the chunk...

From observing MICO with tcpdump:

getPoint() call
^^^^^^^^^^^^^^^
GIOP Header
47 49 4f 50 GIOP
01 00       version major 1, minor 0
01          little endian
00          Message type: Request (0)
38 00 00 00 Message size: 56

GIOP Request
            ServiceContextList
00 00 00 00   SequenceLength: 0
02 00 00 00 Request id: 2
01          Response expectedL 1
14 00 00 00 Object Key length: 20
...         /12496/1626603213/_0
09 00 00 00 Operation Length: 9
...         getPoint\0
00 00 00 00 Requesting Principal Length: 0

getPoint() reply()
^^^^^^^^^^^^^^^^
GIOP Header with Reply(1)

GIOP Reply Header
            ServiceContextList
00 00 00 00   SequenceLength: 0
02 00 00 00 Request id: 2
00 00 00 00 Reply status: No Exception (0)

GIOP Reply Body

02 ff ff 7f ??
0f 00 00 00 length 15
...         IDL:TPoint:1.0\0
00 00 00 00 00 00 24 40 x (10.0)
00 00 00 00 00 00 34 40 y (20.0)

getDrawing reply
^^^^^^^^^^^^^^^^

GIOP Reply Body

02 ff ff 7f <value_tag> 0x7fffff00 to 0x7fffffff
            2: only a single repository id is in the encoding
10 00 00 00 length 16
..          IDL:Drawing:1.0\0

03 00 00 00 sequence length

02 ff ff 7f <value_tag>
10 00 00 00 length
...         IDL:TFigure:1.0\0  Repository ID
2a 00 00 00 id = 42

02 ff ff 7f 
10 00 00 00 length
54 00 00 00 id = 84

02 ff ff 7f
14 00 00 00 IDL:TConnection:1.0\0
60 00 00 00 id = 96

ff ff ff ff TCKind: none, indirection
a4 ff ff ff indirection (relative pointer to object?)
            a4 = -92

ff ff ff ff TCKind: none, indirection
b8 ff ff ff indirection, positive indirection are reserved for future use


// are stringify and destringify directly available?

// padding is relative to message, in this case the GIOP header

0000   47 49 4f 50 01 00 01 01 90 00 00 00 00 00 00 00   GIOP............
       ^           ^  ^  ^  ^  ^           ^
       |           |  |  |  |  |           service context list length
       |           |  |  |  |  message size
       |           |  |  |  message type: 1 = reply
       |           |  |  little endian
       |           |  minor version
       |           major version
       GIOP
       
0010   04 00 00 00 00 00 00 00 02 ff ff 7f 10 00 00 00   ................
       ^           ^           ^           ^
       |           |           value_tag   type_info -> repository_id -> string -> strlen
       |           reply status: no exception
       request id 4
0020   49 44 4c 3a 44 72 61 77 69 6e 67 3a 31 2e 30 00   IDL:Drawing:1.0.

0030   03 00 00 00 02 ff ff 7f 10 00 00 00 49 44 4c 3a   ............IDL:
       ^           ^           ^
       |           |           type_info -> repository_id -> string -> strlen
       |           value_tag
       sequence -> length -> long
0040   54 46 69 67 75 72 65 3a 31 2e 30 00 2a 00 00 00   TFigure:1.0.*...
                                           ^
                                           TFigure.id = 42
0050   02 ff ff 7f 10 00 00 00 49 44 4c 3a 54 46 69 67   ........IDL:TFig
       ^           ^
       |           type_info -> repository_id -> string -> strlen
       value_tag
0060   75 72 65 3a 31 2e 30 00 54 00 00 00 02 ff ff 7f   ure:1.0.T.......
                               ^           ^
                               |           value_tag
                               TFigure.id = 84
0070   14 00 00 00 49 44 4c 3a 54 43 6f 6e 6e 65 63 74   ....IDL:TConnect
       ^
       type_info -> repository_id -> string -> strlen
0080   69 6f 6e 3a 31 2e 30 00 60 00 00 00 ff ff ff ff   ion:1.0.`.......
                               ^           ^
                               |           value_ref
                               TFigure.id = 96
0090   a4 ff ff ff ff ff ff ff b8 ff ff ff               ............
       ^           ^           ^
       |           |           -72 -> to 2nd figure
       |           value_ref
       -92 -> 0x0034 value_tag of 1st figure

9.3.4.8 The Format

<value> :=
    <value_tag> [<codebase_URL>] [<type_info>] <state>
  | <value_ref>

<value_ref> :=
    <indirection_tag> <indirection>		; pointer to another object
  | <null_tag>                                  ; null pointer

<type_info> := <rep_ids> | <repository_id>

<repository_id> :=
    <string>
  | <indirection_tag> <indirection>		; pointer to another repository_id for reuse

<value_tag> := long (0x7fffff00 to 0x7fffffff)
<state> := 
    <octets>
  | <value_data>+ [<end_tag>]

<value_data> := 
    <value_chunk>
  | <value>

<indirection_tag> ::= (long) 0xffffffff
<indirection> ::= long // -2^31 < indirection < 0 
<octets> := octet | octet <octets>
  
<rep_ids> ::= 
    long <repository_id>+ 
  | <indirection_tag> <indirection>
  
<repository_id> ::= ( string | <indirection_tag> <indirection> ) 

<flag_tag> := (octet) 0 | <codebase_flag>
<codebase_flag> ::= (octet) 1
<value_block> ::= <block_size_tag> <octets>
<null_tag> ::= (long) 0

<codebase_URL> ::= ( string | <indirection_tag> <indirection> )
<block_size_tag> ::= long // 0 < block_size_tag < 2^31-256 (0x7fffff00)
<end_tag> := long // -2^31 < end_tag < 0


	0x0000:  4500 0078 c3c6 4000 4006 f296 c0a8 0169  E..x..@.@......i
	0x0010:  c0a8 0169 bbd2 2328 4858 08b6 229f c2e3  ...i..#(HX.."...
	0x0020:  8018 0200 848d 0000 0101 080a c912 5681  ..............V.

send by mico, works
	0x0030:  47 49 4f 50 01 00 01 00 38 00 00 00 00 00 00 00  GIOP....8.......
	0x0040:  02 00 00 00 01 00 00 00 13 00 00 00 2f 31 35 35  ............/155
	0x0050:  37 2f 31 36 32 36 37 32 32 35 35 39 2f 5f 30 00  7/1626722559/_0.
	0x0060:  09 00 00 00 67 65 74 50 6f 69 6e 74 00 00 00 00  ....getPoint....
	0x0070:  00 00 00 00                                      ....

0000 47 49 4f 50 01 00 00 00 00 00 00 38 00 00 00 00 GIOP.......8....
0010 00 00 00 01 00 00 00 01 00 00 00 13 2f 31 30 39 ............/109
0020 32 2f 31 36 32 36 38 30 31 31 31 33 2f 5f 30 00 2/1626801113/_0.
0030 00 00 00 09 67 65 74 50 6f 69 6e 74 00 00 00 00 ....getPoint....
0040 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ................

NOTE: it seems that some strings are 0 terminate while others are not

object key: 19 bytes, 0x13, no trailing 0
/1557/1626722559/_0

9 bytes, trailing 0
getPoint

oneway setPoint with valuetype (server doesn't call the implementation)

	0x0000:  4500 00a4 b5f4 4000 4006 855d 7f00 0001  E.....@.@..]....
	0x0010:  7f00 0101 cd36 acdd 3c79 28e5 549d 3b8f  .....6..<y(.T.;.
	0x0020:  8018 0200 ff98 0000 0101 080a c132 87c5  .............2..
	0x0030:  8e59 2eda 4749 4f50 0100 0100 6400 0000  .Y..GIOP....d...
	0x0040:  0000 0000 0200 0000 0000 0000 1300 0000  ................
	0x0050:  2f31 3330 372f 3136 3237 3036 3534 3130  /1307/1627065410
	0x0060:  2f5f 3000 0900 0000 7365 7450 6f69 6e74  /_0.....setPoint
	0x0070:  0000 0000 0000 0000 02ff ff7f 0e00 0000  ................
	0x0080:  4944 4c3a 506f 696e 743a 312e 3000 0000  IDL:Point:1.0...
	0x0090:  0000 0000 6f12 83c0 ca21 0940 c9e5 3fa4  ....o....!.@..?.
	0x00a0:  dfbe 0540                                ...@

oneway setPoint with struct

	0x0000:  4500 008c b5f5 4000 4006 8574 7f00 0001  E.....@.@..t....
	0x0010:  7f00 0101 cd36 acdd 3c79 2955 549d 3b8f  .....6..<y)UT.;.
	0x0020:  8018 0200 ff80 0000 0101 080a c132 87c5  .............2..
	0x0030:  8e59 2eda 4749 4f50 0100 0100 4c00 0000  .Y..GIOP....L...
	0x0040:  0000 0000 0300 0000 0100 0000 1300 0000  ................
	0x0050:  2f31 3330 372f 3136 3237 3036 3534 3130  /1307/1627065410
	0x0060:  2f5f 3000 0a00 0000 7365 7453 506f 696e  /_0.....setSPoin
	0x0070:  7400 0000 0000 0000 0000 0000 6f12 83c0  t...........o...
	0x0080:  ca21 0940 c9e5 3fa4 dfbe 0540            .!.@..?....@

Object Reference (could this be an IOR?)

0000   47 49 4f 50 01 00 01 01 88 00 00 00 00 00 00 00  GIOP............
       ^           ^  ^  ^  ^  ^           ^
       |           |  |  |  |  |           service context list length
       |           |  |  |  |  message size
       |           |  |  |  message type: 1 = reply
       |           |  |  little endian
       |           |  minor version
       |           major version
       GIOP
0010   02 00 00 00 00 00 00 00 0e 00 00 00 49 44 4c 3a  ............IDL:
       ^           ^           ^           ^
       |           |           |           OID
       |           |           OID length
       |           reply status: no exception
       request id 2
0020   42 6f 61 72 64 3a 31 2e 30 00 00 00 02 00 00 00  Board:1.0.......
                                           ^
                                           sequence length
0030   00 00 00 00 2f 00 00 00 01 01 00 00 0e 00 00 00  ..../...........
       ^           ^           ^           ^
       |           |           |           strlen = 14 host
       |           |           iiop version major/minor
       |           tag length
       tag id: TAG_INTERNET_IOP (9.7.2 IIOP IOR Profiles)            
0040   31 39 32 2e 31 36 38 2e 31 2e 31 30 35 00 28 23  192.168.1.105.(#
                                                 ^ port
       13 00 00 00 2f 31 33 39 32 2f 31 36 33 30 32 33  ..../1392/163023
       ^
       objectID len = 19
       39 35 30 32 2f 5f 31 00 01 00 00 00 24 00 00 00  9502/_1.....$...
                               ^           ^
                               |           tag length
                               tag id: TAG_MULTIPLE_COMPONENTS
       01 00 00 00 01 00 00 00 01 00 00 00 14 00 00 00  ................
       01 00 00 00 01 00 01 00 00 00 00 00 09 01 01 00  ................
       00 00 00 00                                      ....

15

tweaking corba.js for GIOP

corba.js creates:

<name>.ts       interfaces for IDL interfaces
<name>_skel.ts  abstract classes for the servers, need to be implemented by the user
<name>_stub.ts  client side stubs to call the implementations of the skeletons on the server

<name>_value.ts interfaces for IDL valuetypes
                methods to initialize valuetype objects from JSON
                  function initVTPoint(object: VTPoint, init?: Partial<VTPoint>)
                lists of attributes defined in each valuetype
                (this is used convert the valuetype into JSON)
                  ORB.valueTypeByName.set("VTPoint", {attributes:["x", "y"]})
<name>_valuetype.ts
                interfaces for IDL valuetypes extended with methods

what the user has to do:

choose an implementation to be used for the valuetype:
  ORB.registerValueType("VTPoint", VTPoint)
in the valuetypes constructor, call the initialization method
  class VTPoint implements value.VTPoint {
      constructor(init: Partial<VTPoint>) {
          value.initVTPoint(this, init)
      }
  }

next steps:
* don't register valuetypes globally but bind them to the ORB to avoid naming collisions.
  instead of

    ORB.registerValueType("Point", Point)

  we could turn this into

    orb.registerValueType(Point, value.spec.Point_1_0)

  -> replaces ORB.registerValueType(...)
  -> replaces ORB.valueTypeByName.set(...)

  and later with the introduction of versioning this could become

    orb.registerConverter(Point_1_0, value.spec.Point_1_0, Point_1_0_Converter)
    orb.registerValueType(value.spec.Point_1_1, Point)

    orb->register_value_factory("IDL:space/Box:1.0", new Box_Factory());

  -> class Point implements value.Point {
        constructor(init: Partial<Point> | GIOPDecoder) {
          value.unmarshalPoint(this, init)
        }
     }

   hmm, that would look nice in the initPoint function...
   if we'd name it unmarshal* it would be a better fit with the CORBA terminology...
