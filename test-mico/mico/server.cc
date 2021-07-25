#include "native.h"
#include "test.h"
#include "test_impl.h"
#include "rectangle.h"
#include <iostream>
#include <fstream>

#include "valueimpl.hh"

using namespace std;

::Board_ptr Server_impl::getBoard(CORBA::UShort boardID) throw(::CORBA::SystemException)
{
    cout << "Server_impl::getBoard(" << boardID << ")" << endl;
    auto board = new Board_impl();
    return board->_this();
}

// we can return null!
Point* Server_impl::getPoint() throw(::CORBA::SystemException)
{
    cout << "Server_impl::getPoint()" << endl;
    return new Point_impl(3.1415, 2.7182);
}

void Server_impl::setPoint(::Point* point) throw(::CORBA::SystemException)
{
//   cout << "Server_impl::setPoint()" << endl;
  cout << "Server_impl::setPoint() -> " << point->x() << ", " << point->y() << endl;
}

void Server_impl::setSPoint( const ::SPoint& point ) throw(::CORBA::SystemException)
{
   cout << "Server_impl::setSPoint()" << endl;
//  cout << "Server_impl::setPoint() -> " << point->x() << ", " << point->y() << endl;
}

void Server_impl::setPoint2(::Point* point) throw(::CORBA::SystemException)
{
   cout << "Server_impl::setPoint2()" << endl;
//  cout << "Server_impl::setPoint() -> " << point->x() << ", " << point->y() << endl;
}

void Server_impl::setSPoint2( const ::SPoint& point ) throw(::CORBA::SystemException)
{
   cout << "Server_impl::setSPoint2()" << endl;
//  cout << "Server_impl::setPoint() -> " << point->x() << ", " << point->y() << endl;
}

void Server_impl::setBox(space::Box* box) throw(CORBA::SystemException) {
  cout << "Server_impl::setBox("
       << box->p0()->x() << ", "
       << box->p0()->y() << ", "
       << box->p1()->x() << ", "
       << box->p1()->y() << ") "
       << (box->p0() == box->p1() ? "same point" : "different points")
       <<endl;
}

void Server_impl::raise() throw(CORBA::SystemException, MyException) {
  cout << "Server_impl::raise()" << endl;
  throw new MyException("yikes");
}

Figure*
Server_impl::getFigure() throw(::CORBA::SystemException)
{
    cout << "Server_impl::getFigure()" << endl;
    return new Figure_impl(42);
}

Drawing*
Server_impl::getDrawing() throw(::CORBA::SystemException)
{
    cout << "Server_impl::getFigure()" << endl;
    auto drawing = new Drawing_impl();
    drawing->data().length(3);
    drawing->data()[0] = new Figure_impl(42);
    drawing->data()[1] = new Figure_impl(84);
    drawing->data()[2] = new Connection_impl(96, drawing->data()[0], drawing->data()[1]);
    return drawing;
}

::BoardListener_ptr listener;

void
Board_impl::addListener(::BoardListener_ptr listener) throw(::CORBA::SystemException)
{
  cout << "Board_impl::addListener()" << endl;
  ::listener = BoardListener::_duplicate(listener);
}

void
//Board_impl::translate(SequenceTmpl<CORBA::UShort,MICO_TID_DEF> ids, const ::Point& delta) throw(::CORBA::SystemException)
Board_impl::translate(SequenceTmpl<CORBA::UShort,MICO_TID_DEF> ids, ::Point* delta)
  throw (CORBA::SystemException)
{
  cout << "Board_impl::translate()" << endl;
  for(size_t i=0; i<ids.length(); ++i) {
    cout << "  ids[" << i << "] = " << ids.get_buffer()[i] << endl;
  }
  cout << "  delta = (" << delta->x() << ", " << delta->y() << ")" << endl;
  if (listener) {
/*
        SequenceTmpl<CORBA::UShort,MICO_TID_DEF> ids;
        ids.length(2);
        CORBA::UShort *buffer = ids.get_buffer();
        buffer[0] = 47;
        buffer[1] = 11;
        Point point;
        point.x = 1;
        point.y = 2;
*/
cout << "call listener" << endl;
    listener->translate(ids, delta);
cout << "called listener" << endl;
  }
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
        // init ORB and POA Manager
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv, "mico-local-orb");

//        auto *factory = new toad::RectangleFactory();
//        orb->register_value_factory("IDL:Rectangle:1.0", factory);

        CORBA::Object_var poaobj = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_var poa = PortableServer::POA::_narrow( poaobj);
        PortableServer::POAManager_var mgr = poa->the_POAManager();

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

        // create a new instance of the servant
        Server_impl *impl = new Server_impl();
        // activate the servant
        Server_var f = impl->_this();
        // save the Interoperable Object Reference (IOR) to a file
        CORBA::String_var s = orb->object_to_string(f);
        ofstream out( "IOR.txt");
        out << s << endl;
        out.close();
        // activate POA manager
        mgr->activate();
        // run the ORB
        cout << "ORB is running..." << endl;
        orb->run();
        poa->destroy( TRUE, TRUE);
        delete impl;
        rc = 0;
    }
    catch(CORBA::SystemException_catch& ex)
    {
        ex -> _print(cerr);
        cerr << endl;
        rc = 1;
    }
    return rc;
}
