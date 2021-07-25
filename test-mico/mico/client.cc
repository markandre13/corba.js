#include "native.h"
#include "test.h"
#include "test_impl.h"
#include "rectangle.h"
#include <iostream>
#include <fstream>
#include <unistd.h>

#include "valueimpl.hh"

using namespace std;

//BoardListener_impl::translate(SequenceTmpl< CORBA::UShort,MICO_TID_DEF> ids, const ::Point& delta) throw(::CORBA::SystemException)
void BoardListener_impl::translate( SequenceTmpl< CORBA::UShort,MICO_TID_DEF> ids, ::Point* delta )
  throw (CORBA::SystemException)
{
    cout << "BoardListener_impl::translate()" << endl;
}

#define REGISTER_VALUE_TYPE(T) \
  struct T ## _Factory: public CORBA::ValueFactoryBase { \
    CORBA::ValueBase* create_for_unmarshal () { \
      return new T ## _impl(); \
    } \
  }; \
  orb->register_value_factory ("IDL:" #T ":1.0", new T ## _Factory());

int
main(int argc, char **argv)
{
    int rc = 0;
    
    try {
        // initialize corba
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);
        CORBA::Object_ptr o = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_ptr poa = PortableServer::POA::_narrow(o);
        
        REGISTER_VALUE_TYPE(Point)
        REGISTER_VALUE_TYPE(Size)
        REGISTER_VALUE_TYPE(Figure)
        REGISTER_VALUE_TYPE(Connection)
        REGISTER_VALUE_TYPE(Drawing)

        struct Box_Factory: public CORBA::ValueFactoryBase {
          CORBA::ValueBase* create_for_unmarshal () {
            return new space::Box_impl();
          }
        };
        orb->register_value_factory ("IDL:space/Box:1.0", new Box_Factory());

        // use IOR written by server into file to create Stub for remote Server object
        ifstream in( "IOR.txt");
        char s[1000];
        in >> s;
        in.close(); 
        CORBA::Object_var obj = orb->string_to_object(s);
        Server_var server = Server::_narrow(obj);
        cout << "got Server object" << endl;
        
//        Point *point = server->getPoint();
//        cout << "got point: " << point->x() << ", " << point->y() << endl;

//        Point_var point = new Point_impl(3.1415, 2.7182);
//        server->setPoint(point);

        Point_var p0 = new Point_impl(1.1, 2.1);
        Point_var p1 = new Point_impl(1.2, 2.2);

        space::Box_var box = new space::Box_impl(p0, p1);
        server->setBox(box);
/*
        Point_var point2 = new Point_impl(3.1415, 2.7182);
        server->setPoint2(point2);

        SPoint spoint = { 3.1415, 2.7182 };
        server->setSPoint(spoint);
        SPoint spoint2 = { 3.1415, 2.7182 };
        server->setSPoint2(spoint);
*/       
//        sleep(20);
        
/*        
        TFigure *figure = server->getFigure();
        cout << "got figure: " << figure->toString() << endl;

        Drawing *drawing = server->getDrawing();
        cout << "got drawing" << endl;
        
        // [], length(), release()
        cout << "  drawing.data.length = " << drawing->data().length() << endl;
        for(unsigned i=0; i<drawing->data().length(); ++i) {
            cout << "data[" << i << "] = " << drawing->data()[i]->toString() << endl;
        }
/*
/*
        // ...
        Board_var board = server->getBoard(1);
        cout << "got Board" << endl;
        
        // set local object
        BoardListener_impl *servant = new BoardListener_impl();
        poa->activate_object(servant);
        CORBA::Object_ptr obj2 = poa->servant_to_reference(servant);
        BoardListener_ptr listener = BoardListener::_narrow(obj2);
        board->addListener(listener);
        cout << "set BoardListener" << endl;
        
        SequenceTmpl<CORBA::UShort,MICO_TID_DEF> ids;
        ids.length(2);
        CORBA::UShort *buffer = ids.get_buffer();
        buffer[0] = 47;
        buffer[1] = 11;
        Point point;
        point.x = 1;
        point.y = 2;
//        board->translate(ids, point);
//        cout << "translated point" << endl;
*/
    }
    catch(CORBA::SystemException_catch& ex) {
        ex -> _print(cerr);
        cerr << endl;
        rc = 1;
    }

    return rc;
}
