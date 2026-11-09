/**
 * Future module design contracts. These are intentional planning specifications,
 * not active economic systems. Build features against these briefs incrementally.
 */
export const futureModules={
 Empire:{
  title:'Empire',subtitle:'Build and control a multinational transport and investment group.',
  goal:'Unify all operating divisions into one holding company, with regional market share, acquisitions, corporate strategy and a meaningful long-term endgame.',
  experience:['See consolidated asset values, debt, cash, profits and operating divisions without double-counting.','Compete against financially simulated rivals for territory, passengers and contracts.','Buy minority stakes, negotiate controlling interests, acquire businesses and integrate their assets.'],
  integrations:['Existing corporate subsidiaries, equity, banking and Finance ledgers','Taxi fleets, depots, ferry routes, hotel/parking investments','Discovered Greek cities and regions from the map'],
  phases:[['Foundation','Live consolidated portfolio dashboard, division profitability and asset drill-down.'],['Regional competition','Market share, rival-company simulation, regional demand and reputation.'],['Acquisitions','Offer, negotiation, minority-to-majority ownership, purchase financing and integration.'],['Global group','Headquarters development, foreign subsidiaries, cross-border reporting and strategic objectives.']],
  metrics:['Group enterprise value','Net asset value','Division operating profit','Regional market share','Debt and cash runway'],
  rules:['Use actual existing finances; never fabricate live KPIs.','Keep competing firms aggregated: do not simulate hundreds of rival vehicles on the map.','Acquisitions require affordability, accounting and rollback-safe persistence.']
 },
 Aviation:{
  title:'Aviation',subtitle:'Build an airline from domestic routes to an international network.',
  goal:'Operate profitable scheduled air services using real airport POIs, aircraft capabilities and passenger demand.',
  experience:['Purchase or lease aircraft with seats, range, operating cost and maintenance schedules.','Open airport-to-airport routes and manage timetables, fares, load factors and airport slots.','Add cargo and charter services as separate airline business lines.'],
  integrations:['Airports and nearby discovered roads','Hotel demand, tourist arrivals and taxi airport transfers','Company treasury, loans, staff and research'],
  phases:[['Foundation','Airport catalogue, aircraft types, route-distance and cost model.'],['Airline operations','Schedules, ticket prices, occupancy and hourly settlement.'],['Fleet management','Aircraft servicing, staffing, leasing and grounded aircraft.'],['Network expansion','Connections, transfers, alliances, cargo and international routes.']],
  metrics:['Passenger load factor','Revenue per available seat','Route margin','Fleet utilisation','On-time performance'],
  rules:['Use route-based timetables instead of animating each flight.','Validate range, seats and airport availability.','Do not assign aircraft or income to routes without ownership.']
 },
 Logistics:{
  title:'Logistics & Cargo',subtitle:'Move goods between real cities and logistics facilities.',
  goal:'Turn the road network into a cargo economy with profitable deliveries, warehouses and supply contracts.',
  experience:['Buy vans and trucks for parcel, bulk and refrigerated deliveries.','Accept contracts with real origins, destinations, deadlines and cargo requirements.','Construct warehouse hubs and optimise multi-stop distribution.'],
  integrations:['Explored road graph and transport workers','Vehicle dealership, depots, fuel and service','POI warehouse/industrial areas and corporate Finance'],
  phases:[['Foundation','Freight vehicle catalogue, load capacities and job generation.'],['Dispatch','Cargo contracts, schedules and route planning on explored roads.'],['Warehousing','Capacity, storage fees, transfer hubs and stock flow.'],['Supply chains','Recurring contracts, perishables, disruptions and intermodal shipping.']],
  metrics:['Revenue per kilometre','Load utilisation','On-time delivery','Warehouse occupancy','Contract profitability'],
  rules:['Respect actual graph connectivity and one-way roads.','Separate cargo vehicles from taxi dispatch.','Keep unloaded/far-away fleets economically simulated to protect FPS.']
 },
 'Public Transport':{
  title:'Public Transport',subtitle:'Run urban buses, airport shuttles and intercity coaches.',
  goal:'Create scheduled shared transport businesses with passenger demand, contracts and realistic service costs.',
  experience:['Build bus routes with stops on accessible discovered roads.','Choose vehicle capacity, frequency, tickets, drivers and operating hours.','Apply for city, school and airport transport concessions.'],
  integrations:['Road graph, depots, drivers and vehicle configurator','Tourism, airport demand and passenger POIs','Public contracts and Finance'],
  phases:[['Foundation','Bus and coach fleet, stops and route editor.'],['Scheduling','Frequency, operating shifts, timetables and fuel costs.'],['Demand','Ridership, fares, overcrowding and service quality.'],['Concessions','Competitive tenders, route subsidies and network expansion.']],
  metrics:['Passengers per game day','Average occupancy','Farebox recovery','Route operating margin','On-time service'],
  rules:['Use only connected stops and valid vehicle routes.','Do not grant revenue to routes without service capacity.','Batch background route simulation rather than ticking each bus every frame.']
 },
 'Real Estate':{
  title:'Real Estate Development',subtitle:'Buy land, develop buildings and operate property assets.',
  goal:'Expand existing fractional investments into construction, upgrades, financing and full property ownership.',
  experience:['Acquire development rights at real hotel, parking and commercial POIs.','Finance buildings through construction phases and manage completion risk.','Operate, renovate, refinance or sell completed assets.'],
  integrations:['Existing hotel and parking ownership ledger','Map POIs, discovered access roads and property valuations','Banking, loans, taxes and Empire holdings'],
  phases:[['Foundation','Property asset registry, land price and development eligibility.'],['Construction','Projects, milestones, progress, budgets and delays.'],['Operations','Units, occupancy, pricing, maintenance and recurring cashflow.'],['Portfolio strategy','Mortgages, renovations, property sales and market valuation.']],
  metrics:['Net operating income','Occupancy','Yield on cost','Loan-to-value','Project return'],
  rules:['Extend existing investments; do not create a second ownership ledger.','Prevent redevelopment or sale without required control.','Deduct capital expenditure before recognising new building income.']
 },
 Automotive:{
  title:'Automotive Business',subtitle:'Own dealerships, rentals and servicing companies.',
  goal:'Transform vehicle purchasing into a full business with inventory, retail customers and after-sales revenue.',
  experience:['Acquire dealerships and maintain physical car inventory.','Set vehicle margins, advertise, sell and finance customer purchases.','Operate rental fleets, workshops and spare-parts inventory.'],
  integrations:['Existing dealership vehicle variants and prices','Company-owned fleets, maintenance and spare vehicle supply','Parking POIs, Finance and Research'],
  phases:[['Foundation','Dealer assets, wholesale/retail prices and inventory.'],['Sales','Lead demand, vehicle sales and inventory turnover.'],['After-sales','Service bays, staff, maintenance bookings and parts.'],['Rentals','Hire contracts, vehicle depreciation and fleet profitability.']],
  metrics:['Gross margin per vehicle','Inventory turnover','Service bay utilisation','Rental occupancy','Capital tied in stock'],
  rules:['Do not let dealership sales duplicate taxi purchase inventory.','Purchased stock must cost cash immediately.','Vehicles sold cannot remain in player fleet.']
 },
 Shipping:{
  title:'Maritime & Shipping',subtitle:'Operate cargo vessels, cruise lines and port businesses.',
  goal:'Build maritime operations on top of the existing ferry harbour network.',
  experience:['Buy vessels with capacity, range, speed and fuel consumption.','Negotiate port access, chart routes and schedule freight or cruise voyages.','Expand into terminals, storage and intermodal connections.'],
  integrations:['Existing real ferry harbours and water routes','Port POIs, cargo logistics and hotel tourism','Company finance, fuel and maintenance'],
  phases:[['Foundation','Port catalogue and vessel fleet.'],['Voyages','Shipping schedules, port fees and cargo/passenger loads.'],['Terminals','Warehouses, berth capacity and service contracts.'],['Global routes','Intermodal links, shipping alliances and larger vessels.']],
  metrics:['Vessel utilisation','Revenue per voyage','Port turnaround time','Fuel cost per tonne','Route contribution margin'],
  rules:['Do not duplicate existing passenger ferry ticket revenue.','Routes must use real valid maritime connections.','Long voyages should advance on game clock without continuous animation.']
 },
 Energy:{
  title:'Energy & Infrastructure',subtitle:'Own fuel stations, charging hubs and energy production.',
  goal:'Control fuel supply for your own fleets and generate sales from public demand.',
  experience:['Purchase service-station stakes at existing fuel and charging POIs.','Set retail margins and expand capacity, storage and charger availability.','Operate renewable generation with investment and maintenance costs.'],
  integrations:['Existing fuel/charging station POIs','Fleet fuel consumption and fuel expense ledger','Parking operations, Research and Finance'],
  phases:[['Foundation','Station ownership and site-level profitability.'],['Retail','Inventory, fuel prices, throughput and cost of goods.'],['Fleet benefits','Integrated fleet refuelling discounts and supply agreements.'],['Generation','Renewables, battery storage and wholesale energy contracts.']],
  metrics:['Litres or kWh sold','Gross margin per unit','Station utilisation','Fleet savings','Energy operating profit'],
  rules:['Own-fleet discounts are cost savings, not phantom extra revenue.','Each energy unit sold must have a purchase or production cost.','Bound inventory and supply effects for offline play.']
 },
 'Stock Market':{
  title:'Stock Market & Banking',subtitle:'Manage shares, bonds, liquidity and financial risk.',
  goal:'Add an investment exchange and treasury decisions without replacing company accounting.',
  experience:['Trade shares in simulated firms with changing business fundamentals.','Purchase bonds, manage fixed-income cashflows and refinancing risk.','Set treasury targets and compare market returns with business expansion.'],
  integrations:['Existing company equity and investor system','Banking, taxation, corporate subsidiaries and Empire','Business-cycle events and simulated competitor earnings'],
  phases:[['Foundation','Exchange listings, simulated valuation and transparent price history.'],['Trading','Orders, positions, commissions and realised gains.'],['Fixed income','Bonds, coupons, maturities and defaults.'],['Advanced treasury','Dividend policy, credit ratings and risk reporting.']],
  metrics:['Portfolio return','Unrealised gains','Dividend income','Liquidity coverage','Investment concentration'],
  rules:['Clearly distinguish player-issued shares from shares owned in other companies.','Do not credit unrealised gains as cash.','Keep exchange prices deterministic and save trades atomically.']
 },
 Infrastructure:{
  title:'Infrastructure Development',subtitle:'Bid, build and operate strategic transport infrastructure.',
  goal:'Create large-scale construction and concession projects that reshape the economy.',
  experience:['Bid for depot, terminal, road maintenance and station contracts.','Allocate capital, contractors and materials across project milestones.','Operate completed concessions and collect permitted user fees.'],
  integrations:['Real road graph and operational depots','Logistics, government contracts, Finance and Empire','Map services and industrial POIs'],
  phases:[['Foundation','Project catalogue, eligibility and tender terms.'],['Construction','Work packages, deadlines, budgeting and contractor capacity.'],['Operations','Maintenance, congestion and concession revenue.'],['Major projects','Multiregional partnerships, debt and public-private agreements.']],
  metrics:['Projects completed','Cost variance','Deadline adherence','Concession yield','Maintenance backlog'],
  rules:['Do not claim changes to actual map road geometry without a road-data pipeline.','No passive income until the project is commissioned.','Track liabilities, not only construction rewards.']
 },
 Tourism:{
  title:'Tourism & Hospitality',subtitle:'Bundle hotels, taxis, ferries and attractions into holidays.',
  goal:'Turn the transport and property portfolio into an integrated travel company.',
  experience:['Create holiday packages across accessible cities, ports and airports.','Bundle owned hotel nights with airport transfers and ferry tickets.','Compete for seasonal travellers using quality, reputation and pricing.'],
  integrations:['Existing hotel investment positions and operations','Taxis, ferries, airports and discovered tourist POIs','Contracts, pricing research and marketing'],
  phases:[['Foundation','Tourist destinations, seasons and package components.'],['Packages','Pricing, capacity reservations and customer demand.'],['Operations','Fulfil trips with hotel rooms and owned transport.'],['Growth','Brand reputation, travel agents and international customers.']],
  metrics:['Package contribution margin','Guests served','Booking conversion','Customer satisfaction','Seasonal demand'],
  rules:['A package must reserve real capacity before recognising sale.','Avoid double-counting hotel or ferry revenue.','Guests travel only through valid transport links.']
 },
 Contracts:{
  title:'Contracts & Tenders',subtitle:'Win recurring transport and service agreements.',
  goal:'Make fleet quality, reliability and operational decisions matter through competitive contracts.',
  experience:['Bid for airport transfers, corporate travel, school transport and hotel shuttles.','Choose price, service level, vehicle class and dedicated capacity.','Deliver against performance requirements or face penalties.'],
  integrations:['Taxi vehicle classes, dispatch and driver rosters','Hotels, airports, company reputation and research','Finance and later bus/logistics companies'],
  phases:[['Foundation','Contract templates, eligibility checks and board.'],['Bidding','Offer pricing, reputation and competitor evaluation.'],['Execution','Recurring assignments, reserved vehicles and payout.'],['Progression','Renewals, tiers, penalties and long-term partnerships.']],
  metrics:['Contract revenue','Bid win rate','Fulfilment rate','Service penalties','Net contribution margin'],
  rules:['Do not award contracts when the fleet cannot meet required capacity.','Deduct fulfilment costs and penalties.','Use worker-based aggregated simulation for large contracts.']
 },
 Workforce:{
  title:'Education & Workforce',subtitle:'Train and recruit drivers, mechanics and business specialists.',
  goal:'Create meaningful staff development and recruitment across business divisions.',
  experience:['Recruit employees with skills, salaries, availability and development potential.','Fund training programmes and certification academies.','Deploy qualified staff to fleets, workshops, airlines and management teams.'],
  integrations:['Existing driver records, shifts and fatigue','Vehicle maintenance, Research and future divisions','Wages, accounting and Empire group staffing'],
  phases:[['Foundation','Unified staff skills, recruitment and staffing needs.'],['Training','Course schedules, cost and measurable skill improvements.'],['Specialisation','Mechanics, managers, bus drivers and pilots.'],['Academies','Own training campuses, tuition and corporate development.']],
  metrics:['Staff retention','Training completion','Labour cost per service','Productivity','Skill coverage'],
  rules:['Extend existing drivers without wiping assignments.','Training occupies staff time and costs money.','Never allow unqualified staff to operate restricted vehicle classes.']
 }
} as const;

export type FutureModuleId=keyof typeof futureModules;
export const futureModuleIds=Object.keys(futureModules) as FutureModuleId[];
export function isFutureModule(name:string):name is FutureModuleId{
 return Object.prototype.hasOwnProperty.call(futureModules,name);
}
