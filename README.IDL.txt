CORBA - Part 1: Interfaces, v3.3, 7.4 IDL Grammar

(1) <specification> ::= <import>* <definition>+
(2) <definition> ::=
        <type_dcl> ";"
        | <const_dcl> ";" 
        | <except_dcl> ";"
        | <interface> ";"
        | <module> ";"
        | <value> ";"
        | <type_id_dcl> ";"
        | <type_prefix_dcl> ";"
        | <event> ";"
        | <component> ";"
        | <home_dcl> ";"
(3) <module> ::= "module" <identifier> "{" <definition>+ "}"
(4) <interface> ::=
        <interface_dcl>
        | <forward_dcl>
(5) <interface_dcl> ::= <interface_header> "{" <interface_body> "}"
(6) <forward_dcl> ::= [ "abstract" | "local" ] "interface" <identifier>
(7) <interface_header> ::= [ "abstract" | "local" ] "interface" <identifier>
            [ <interface_inheritance_spec> ]
(8) <interface_body> ::= <export>*
(9) <export>::=<type_dcl> ";"
        | <const_dcl> ";"
        | <except_dcl> ";"
        | <attr_dcl> ";"
        | <op_dcl> ";"
        | <type_id_dcl> ";"
        | <type_prefix_dcl> ";"
(10) <interface_inheritance_spec> ::= ":" <interface_name> { "," <interface_name> }*
(11) <interface_name> ::= <scoped_name>
(12) <scoped_name> ::=
        <identifier>
        | "::" <identifier>
        | <scoped_name> "::" <identifier>
(13) <value> ::= ( <value_dcl> | <value_abs_dcl> | <value_box_dcl> | <value_forward_dcl> )
(14) <value_forward_dcl> ::= [ "abstract" ] "valuetype" <identifier>
(15) <value_box_dcl> ::= "valuetype" <identifier> <type_spec>
(16) <value_abs_dcl> ::= "abstract" "valuetype" <identifier>
        [ <value_inheritance_spec> ]
        "{" <export>* "}"
(17) <value_dcl> ::= <value_header> "{" < value_element>* "}"
(18) <value_header> ::=
        ["custom" ] "valuetype" <identifier>
        [ <value_inheritance_spec> ]
(19) <value_inheritance_spec> ::= [ ":" [ "truncatable" ] <value_name>
        { "," <value_name> }* ]
        [ "supports" <interface_name>
        { "," <interface_name> }* ]
(20) <value_name> ::=<scoped_name>
(21) <value_element> ::= <export> | < state_member> | <init_dcl>
(22) <state_member> ::= ( "public" | "private" )
        <type_spec> <declarators> ";"
(23) <init_dcl> ::= "factory" <identifier> "(" [ <init_param_decls> ] ")" [ <raises_expr> ] ";"
(24) <init_param_decls> ::= <init_param_decl> { "," <init_param_decl> }*
(25) <init_param_decl> ::= <init_param_attribute> <param_type_spec> <simple_declarator>
(26) <init_param_attribute> ::= "in"
(27) <const_dcl> ::= "const" <const_type> <identifier> "=" <const_exp>
(28) <const_type> ::=
        <integer_type>
        | <char_type>
        | <wide_char_type>
        | <boolean_type>
        | <floating_pt_type>
        | <string_type>
        | <wide_string_type>
        | <fixed_pt_const_type>
        | <scoped_name>
        | <octet_type>
(29) <const_exp> ::= <or_expr>
(30) <or_expr> ::=
        <xor_expr>
        | <or_expr> "|" <xor_expr>
(31) <xor_expr> ::=
        <and_expr>
        | <xor_expr> "^" <and_expr>
(32) <and_expr> ::=
        <shift_expr>
        | <and_expr> "&" <shift_expr>
(33) <shift_expr> ::=
        <add_expr>
        | <shift_expr> ">>" <add_expr>
        | <shift_expr> "<<" <add_expr>
(34) <add_expr> ::=
        <mult_expr>
        | <add_expr> "+" <mult_expr>
        | <add_expr> "-" <mult_expr>
(35) <mult_expr> ::=
        <unary_expr>
        | <mult_expr> "*" <unary_expr>
        | <mult_expr> "/" <unary_expr>
        | <mult_expr> "%" <unary_expr>
(36) <unary_expr> ::= <unary_operator> <primary_expr>
        | <primary_expr>
(37) <unary_operator> ::=
        "-"
        | "+"
        | "~"
(38) <primary_expr> ::=
        <scoped_name>
        | <literal>
        | "(" <const_exp> ")"
(39) <literal> ::=
        <integer_literal>
        | <string_literal>
        | <wide_string_literal>
        | <character_literal>
        | <wide_character_literal>
        | <fixed_pt_literal>
        | <floating_pt_literal>
        | <boolean_literal>
(40) <boolean_literal> ::= "TRUE" | "FALSE"
(41) <positive_int_const> ::= <const_exp>
(42) <type_dcl> ::= "typedef"
        <type_declarator> <struct_type>
        | <union_type>
        | <enum_type>
        | "native" <simple_declarator>
        | <constr_forward_decl>
(43) <type_declarator> ::= <type_spec> <declarators>
(44) <type_spec> ::=
        <simple_type_spec>
        | <constr_type_spec>
(45) <simple_type_spec> ::=
        <base_type_spec>
        | <template_type_spec>
        | <scoped_name>
(46) <base_type_spec> ::=
        <floating_pt_type>
        | <integer_type>
        | <char_type>
        | <wide_char_type>
        | <boolean_type>
        | <octet_type>
        | <any_type>
        | <object_type>
        | <value_base_type>
(47) <template_type_spec> ::=
        <sequence_type>
        | <string_type>
        | <wide_string_type>
        | <fixed_pt_type>
(48) <constr_type_spec> ::=
        <struct_type>
        | <union_type>
        | <enum_type>
(49) <declarators> ::= <declarator> { "," <declarator> }*
(50) <declarator> ::=
        <simple_declarator>
        | <complex_declarator>
(51) <simple_declarator> ::= <identifier>
(52) <complex_declarator> ::= <array_declarator>
(53) <floating_pt_type> ::=
        "float"
        | "double"
        | "long" "double"
(54) <integer_type> ::=
        <signed_int>
        | <unsigned_int>
(55) <signed_int> ::=
        <signed_short_int>
        | <signed_long_int>
        | <signed_longlong_int>
(56) <signed_short_int> ::= "short"
(57) <signed_long_int> ::= "long"
(58) <signed_longlong_int> ::= "long" "long"
(59) <unsigned_int> ::=
        <unsigned_short_int>
        | <unsigned_long_int>
        | <unsigned_longlong_int>
(60) <unsigned_short_int> ::= "unsigned" "short"
(61) <unsigned_long_int> ::= "unsigned" "long"
(62) <unsigned_longlong_int> ::= "unsigned" "long" "long"
(63) <char_type> ::= "char"
(64) <wide_char_type> ::= "wchar"
(65) <boolean_type> ::= "boolean"
(66) <octet_type> ::= "octet"
(67) <any_type> ::= "any"
(68) <object_type> ::= "Object"
(69) <struct_type> ::= "struct" <identifier> "{" <member_list> "}"
(70) <member_list> ::= <member>+
(71) <member> ::= <type_spec> <declarators> ";"
(72) <union_type> ::= "union" <identifier> "switch"
        "(" <switch_type_spec> ")"
        "{" <switch_body> "}"
(73) <switch_type_spec> ::=
        <integer_type>
        | <char_type>
        | <boolean_type>
        | <enum_type>
        | <scoped_name>
(74) <switch_body> ::= <case>+
(75) <case> ::= <case_label>+ <element_spec> ";"
(76) <case_label> ::=
        "case" <const_exp> ":"
        | "default" ":"
(77) <element_spec> ::= <type_spec> <declarator>
(78) <enum_type> ::= "enum" <identifier> "{" <enumerator> { "," <enumerator> }∗ "}"
(79) <enumerator> ::= <identifier>
(80) <sequence_type>::="sequence" "<" <simple_type_spec> "," <positive_int_const> ">" | "sequence" "<" <simple_type_spec> ">"
(81) <string_type>::="string" "<" <positive_int_const> ">" | "string"
(82) <wide_string_type>::="wstring" "<" <positive_int_const> ">" | "wstring"
(83) <array_declarator>::=<identifier> <fixed_array_size>+
(84) <fixed_array_size>::="[" <positive_int_const> "]"
(85) <attr_dcl> ::= <readonly_attr_spec> | <attr_spec>
(86) <except_dcl>::="exception" <identifier> "{" <member>* "}"
(87) <op_dcl>::=[ <op_attribute> ] <op_type_spec> <identifier> <parameter_dcls>
        [ <raises_expr> ] [ <context_expr> ]
(88) <op_attribute>::="oneway"
(89) <op_type_spec>::=<param_type_spec> | "void"
(90) <parameter_dcls>::="(" <param_dcl> { "," <param_dcl> }∗ ")" | "(" ")"
(91) <param_dcl>::=<param_attribute> <param_type_spec> <simple_declarator>
(92) <param_attribute> ::=
        "in"
        | "out"
        | "inout"
(93) <raises_expr>::="raises" "(" <scoped_name> { "," <scoped_name> }∗ ")"
(94) <context_expr>::="context" "(" <string_literal> { "," <string_literal> }∗ ")"
(95) <param_type_spec> ::=
        <base_type_spec>
        | <string_type>
        | <wide_string_type>
        | <scoped_name>
(96) <fixed_pt_type>::="fixed" "<" <positive_int_const> "," <positive_int_const> ">"
(97) <fixed_pt_const_type>::="fixed"
(98) <value_base_type>::= "ValueBase"
(99) <constr_forward_decl>::="struct" <identifier> | "union" <identifier>
(100) <import> ::= "import" <imported_scope> ";"
(101) <imported_scope> ::= <scoped_name> | <string_literal>
(102) <type_id_dcl> ::="typeid" <scoped_name> <string_literal>
(103) <type_prefix_dcl>::="typeprefix" <scoped_name> <string_literal>
(104) <readonly_attr_spec> ::= "readonly" "attribute" <param_type_spec> <readonly_attr_declarator>
(105) <readonly_attr_declarator>::= <simple_declarator> <raises_expr> | <simple_declarator>
        { "," <simple_declarator> }*
(106) <attr_spec> ::= "attribute" <param_type_spec>
        <attr_declarator>
(107) <attr_declarator> ::=<simple_declarator> <attr_raises_expr> | <simple_declarator>
        { "," <simple_declarator> }*
(108) <attr_raises_expr> ::=<get_excep_expr> [ <set_excep_expr> ] | <set_excep_expr>
(109) <get_excep_expr> ::= "getraises" <exception_list>
(110) <set_excep_expr> ::= "setraises" <exception_list>
(111) <exception_list>::= "(" <scoped_name>
        { "," <scoped_name> } * ")"
(112) <component> ::=
        <component_dcl>
        | <component_forward_dcl>
(113) <component_forward_dcl> ::= "component" <identifier>
(114) <component_dcl> ::= <component_header> "{" <component_body> "}"
(115) <component_header> ::= "component" <identifier> [ <component_inheritance_spec> ]
        [ <supported_interface_spec> ]
(116) <supported_interface_spec> ::= "supports" <scoped_name> { "," <scoped_name> }*
(117) <component_inheritance_spec> ::= ":" <scoped_name>
(118) <component_body> ::=<component_export>*
(119) <component_export> ::=
        <provides_dcl> ";"
        | <uses_dcl> ";"
        | <emits_dcl> ";"
        | <publishes_dcl> ";"
        | <consumes_dcl> ";"
        | <attr_dcl> ";"
(120) <provides_dcl> ::= "provides" <interface_type> <identifier>
(121) <interface_type> ::= <scoped_name> | "Object"
(122) <uses_dcl> ::= "uses" [ "multiple" ] < interface_type> <identifier>
(123) <emits_dcl> ::= "emits" <scoped_name> <identifier>
(124) <publishes_dcl> ::= "publishes" <scoped_name> <identifier>
(125) <consumes_dcl> ::= "consumes" <scoped_name> <identifier> (126) <home_dcl> ::= <home_header> <home_body>
(127) <home_header> ::= "home" <identifier> [ <home_inheritance_spec> ]
        [ <supported_interface_spec> ] "manages" <scoped_name> [ <primary_key_spec> ]
(128) <home_inheritance_spec> ::= ":" <scoped_name>
(129) <primary_key_spec> ::= "primarykey" <scoped_name> 
(130) <home_body> ::= "{" <home_export>* "}"
(131) <home_export ::= <export> | <factory_dcl> ";"
        | <finder_dcl> ";"
(132) <factory_dcl> ::= "factory" <identifier>
        "(" [ <init_param_decls> ] ")" [ <raises_expr> ]
(133) <finder_dcl> ::= "finder" <identifier> "(" [ <init_param_decls> ] ")"
        [ <raises_expr> ]
(134) <event> ::= ( <event_dcl> | <event_abs_dcl> | <event_forward_dcl>)
(135) <event_forward_dcl> ::=[ "abstract" ] "eventtype" <identifier>
(136) <event_abs_dcl> ::="abstract" "eventtype" <identifier> [ <value_inheritance_spec> ]
        "{" <export>* "}"
(137) <event_dcl>::=<event_header> "{" <value_element> * "}"
(138) <event_header>::=[ "custom" ] "eventtype" <identifier> [ <value_inheritance_spec> ]
