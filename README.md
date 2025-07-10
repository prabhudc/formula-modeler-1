# Formula Modeler

## Overview

**Formula Modeler** is a full-stack application designed for to be used by end users to create and manage formulas on IT curated data models(HANA). The tool enables centralized formula management and high-performance, in-memory calculations, making it easy for various business applications to consume and leverage these formulas without duplicating data.

---

## Key Features

- **Centralized Formula Management:** Maintain all business formulas in a single, standalone application.
- **Flexible Consumption:** Formulas can be consumed by multiple business applications (e.g., Sales, Finance, Pricing) without data or code duplication.
- **In-Memory Calculation:** All calculations are performed directly in the HANA database for optimal performance.
- **No Data Duplication:** Formula Modeler creates database objects for querying and consuming data, rather than copying data between applications.

---

## How It Works

- Multiple business applications (such as Sales, Finance, Pricing) each have their own application containers and curated HANA models.
- Formula Modeler operates independently, allowing users to define and maintain formulas centrally on top of the application hana models.
- These formulas are then available for consumption by any business application, either through their application/service layer or directly via the database.
- The only requirement for integration is that each business application must grant the necessary privileges (via an `hdbrole`) to expose its HANA models and data to Formula Modeler.

---

## Architecture

The Formula Modeler solution consists of three main layers:

- **SAP HANA Database Container:** Stores curated data models and executes in-memory formula calculations.
- **Node.js Application (Cloud Foundry Runtime):** Hosts the business logic and service APIs.
- **SAPUI5 User Interface:** Provides a modern, user-friendly interface for managing formulas.

### Architecture Integration Patterns

![alt text](<Architecture  diagram.jpg>)
The formula modeler supports two usage  possibilities
1) Standalone applications sharing the same subaccount, but separate hdi containers
2) Separate subaccounts with different containers sharing the hana database.

Application can integrate with the formula modeler via. a sequence of api or database level access.

The business flow of events are as following.

### Use cases
* End users are given the flexibility to create formula with lesser dependency on IT. Scenarios which involve in adjusting formulas on a regular basis could take advantage of the formula modeler.
* A tool that can push down the calculation to the datbase. Results are to be batched and returned.



1. It teams maintain application level calculation. A hdb role is maintained in the application to expose these calculation views alone with SELECT privilege
2. A business user go into formula modeler manager's user interface and adds potential calculation views that are used in the application domain
3. A business user then creates several formulas on the calculation views selected in the previous step. These formulas are now availabled to the consuming application.
4. The consuming application can invoke the formula by means of two approaches.
4.1 Invoking an api in the formula modeler application by passing the formula id as a parameter
4.2 Directly querying a database function within the formula modeler.
5. The consuming application can then decide to render the outcome or apply it to a further calculation.



API Ingress



API egress

API invocation sequence

