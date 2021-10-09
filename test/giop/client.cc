#include "test.h"
#include "test_impl.h"
#include <iostream>
#include <fstream>
#include <sstream>

#define REGISTER_VALUE_TYPE(T) \
  struct T ## _Factory: public CORBA::ValueFactoryBase { \
    CORBA::ValueBase* create_for_unmarshal() { \
      return new T ## _impl(); \
    } \
  }; \
  orb->register_value_factory("IDL:" #T ":1.0", new T ## _Factory());

using namespace std;

const char * blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

class Point_impl: virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Point_impl() {}
    Point_impl(double x, double y) {
      this->x(x);
      this->y(y);
    }
};

int
main(int argc, char **argv) {
    CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);
    CORBA::Object_ptr o = orb->resolve_initial_references("RootPOA");
    PortableServer::POA_ptr poa = PortableServer::POA::_narrow(o);

    ifstream in( "IOR.txt");
    char s[1000];
    in >> s;
    in.close(); 
    CORBA::Object_var obj = orb->string_to_object(s);
    Server_var server = Server::_narrow(obj);
    cout << "got Server object" << endl;

    server->sendBool(false, true);
}
