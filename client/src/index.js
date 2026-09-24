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
import React from "react";
import ReactDOM from "react-dom";
import { createBrowserHistory } from "history";
import { Router, Route, Switch, Redirect } from "react-router-dom";

import AdminLayout from "layouts/Admin/Admin.js";
import RTLLayout from "layouts/RTL/RTL.js";
import { StateProvider } from "./store";

import "assets/scss/black-dashboard-react.scss";
import "assets/demo/demo.css";
import "assets/css/nucleo-icons.css";
import "leaflet/dist/leaflet.css";

const hist = createBrowserHistory();

ReactDOM.render(
  <StateProvider>
    <Router history={hist}>
      <Switch>
        <Route path="/admin" render={(props) => <AdminLayout {...props} />} />
        <Route path="/rtl" render={(props) => <RTLLayout {...props} />} />
        <Redirect from="/" to="/admin/dashboard" />
      </Switch>
    </Router>
  </StateProvider>,
  document.getElementById("root")
);
