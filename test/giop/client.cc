#include <omniORB4/CORBA.h>
#include "giop.hh"
#include <iostream>
#include <fstream>
#include <sstream>

using namespace std;

const char *blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

class Point_impl : virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase
{
public:
    Point_impl() {}
    Point_impl(double x, double y)
    {
        this->x(x);
        this->y(y);
    }
};

// void GIOPSmall_impl::call(const char *msg) throw(::CORBA::SystemException)
// {
//     cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
//     cout << "GIOPSmall::call(\"" << msg << "\")";
// }

int main(int argc, char **argv)
{
    int rc = 0;
    try
    {
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

        class PointFactory: public virtual CORBA::ValueFactoryBase {
            CORBA::ValueBase* create_for_unmarshal() { return new Point_impl(); }
        };
        orb->register_value_factory("IDL:Point:1.0", new PointFactory());

        ifstream in("IOR.txt");
        char s[1000];
        in >> s;
        in.close();
        CORBA::Object_var obj = orb->string_to_object(s);
        GIOPTest_var server = GIOPTest::_narrow(obj);
        cout << "got Server object" << endl;

        // Initialise the POA.
        obj = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_var poa = PortableServer::POA::_narrow(obj);
        PortableServer::POAManager_var pman = poa->the_POAManager();
        pman->activate();

        // server->onewayMethod();

        server->sendValuePoint(new Point_impl(3.1415, 2.17));

        cout << server->peek() << endl;

        //     server->sendBool(false, true);

        //     GIOPSmall_impl *impl = new GIOPSmall_impl();
        //     poa->activate_object(impl);
        //     // activate the servant
        //     GIOPSmall_var small = impl->_this();

        //     cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
        //     server->sendObject(small, "foo");
        //     return 0;

        orb->destroy();
    }
    catch (CORBA::TRANSIENT &)
    {
        cerr << "Caught system exception TRANSIENT -- unable to contact the "
             << "server." << endl;
        rc = 1;
    }
    catch (CORBA::SystemException &ex)
    {
        cerr << "Caught a CORBA::" << ex._name() << endl;
        rc = 1;
    }
    catch (CORBA::Exception &ex)
    {
        cerr << "Caught CORBA::Exception: " << ex._name() << endl;
        rc = 1;
    }
    return rc;
}
