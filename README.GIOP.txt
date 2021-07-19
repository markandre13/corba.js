NOTES ON CORBA'S binary General Inter-ORB Protocol (GIOP)

GIOP FEATURES

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

NOTE: it seems that some strings are 0 terminate while others are not

object key: 19 bytes, 0x13, no trailing 0
/1557/1626722559/_0

9 bytes, trailing 0
getPoint
