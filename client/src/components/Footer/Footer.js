/*!

=========================================================
* SancharNetra Portal v1.0.0
=========================================================

* Developed by: AlgoRhythm
* Copyright 2025 AlgoRhythm
* Licensed under MIT (https://github.com/creativetimofficial/black-dashboard-react/blob/master/LICENSE.md)

* Coded by AlgoRhythm

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
/*eslint-disable*/
import React from "react";
// used for making the prop types of this component
import PropTypes from "prop-types";

// reactstrap components
import { Container, Row, Nav, NavItem, NavLink } from "reactstrap";

class Footer extends React.Component {
  render() {
    return (
      <footer className="footer">
        <Container fluid>
          <Nav>
            <NavItem>
              <NavLink href="#">SancharNetra Portal</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#">About Us</NavLink>
            </NavItem>
          </Nav>
          <div className="copyright">
            © {new Date().getFullYear()} made by{" "}
            <i className="tim-icons icon-heart-2" />{" "}
            <a href="#" target="_blank">
              Team AlgoRhythm
            </a>
          </div>
        </Container>
      </footer>
    );
  }
}

export default Footer;
