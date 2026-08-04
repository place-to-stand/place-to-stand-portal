# [PTS] Weekly Planning — Gemini Notes (verbatim)

> Source: Gemini-generated meeting notes, Aug 3, 2026. Archived verbatim for auditability.
> User framing note when submitting to `/prd-from-transcript`: "this is our weekly planning meeting. we talked about a lot of different things and not all of them will apply to the portal. can you please isolate the portal dev elements and include those in the PRD?"

---

## Quick notes

[PTS] Weekly Planning

Aug 3, 2026
Kris Crawford (kris@placetostandagency.com) Jason Desiderio (jason@placetostandagency.com)

The team discussed service pricing models, refined marketing strategies, and standardized technical communication through updated language protocols.

Strategic Business Model and Growth

* Proposed shift to a one-time fixed setup fee paired with recurring platform maintenance charges (Kris).
* Suggested a platform maintenance fee range of $300–$400 monthly.
* Explored referral strategies utilizing "powered by" attribution models in exchange for free error monitoring.
* Strategizing in-person outreach to Eugene to help address business bandwidth and operations.

Marketing and Lead Generation

* Cleaning up Google Ads by removing mismatched terms and launching an ad group for software alternatives.
* Evaluating AB testing for email capture timing within the audit user journey.
* Investigating Google Ad UTM source tracking for improved conversion attribution.
* Noted anonymous audit submissions; identifying need for archive and acknowledgment features.

Platform and Technical Infrastructure

* Dashboard now supports image uploads, multi-context selection, and granular chat controls.
* Utilizing PostHog CLI for conversion funnel tracking and session replay analysis.
* Exploring potential migration to K3/Vercel infrastructure for anticipated 80% cost reduction.
* Proposed creating an internal, Git-based wiki to centralize documentation and institutional knowledge.

Service Modeling and Pricing Strategy

* Proposed treating email service costs as a marketing or attribution expense instead of charging clients directly (Kris).
* Suggested capping free email volume, such as 500 sends per month, to mitigate potential costs (Jason).
* Proposed offering initial integration services for free to existing clients to build relationships.

Client Management and Relationship Strategy

* Identified goal to negotiate lower service levels and reduced costs for SMG (Jason).
* Prioritized information gathering during upcoming client meetings over making immediate, hasty scope or fee commitments.
* Discussed the definition of a "success story," debating if pre-revenue projects qualify alongside active revenue-generating clients.

Shopify Platform and Integration Strategy

* Clarified that public Shopify apps require a formal review process, while unlisted apps are limited to single-store installations.
* Determined that Shopify apps or direct API keys can serve as viable connectors for back-of-house dashboard fulfillment.
* Noted significant referral potential for Shopify POS, including 20% of payments for 24 months.

AI and Technical Infrastructure

* Debated merits of structured databases versus Claude's markdown-based project storage for managing operational documentation.
* Flagged concerns regarding the scalability of AI "memory" features compared to traversing raw datasets.
* Explored utilizing "Simplified Technical English" to reduce linguistic ambiguity in AI-generated outputs.

Next steps

* [Jason] Contact Alex: Confirm studio availability for next Monday.
* [Jason] Conduct client outreach: Review the full client list to initiate contact for future site visits.
* [Jason] Respond to marketing data: Analyze recent marketing performance recap and feed data into Claude to improve learning outcomes.
* [Jason] Update Adam Butler contact: Input Adam Butler contact information into the business system for future outreach.
* [Kris] Schedule Eugene meeting: Contact Eugene to coordinate an in-person office visit regarding potential business collaboration.
* [Jason] Optimize Google Ads: Remove incorrectly matching search terms and launch a secondary ad group focused on software alternatives.
* [The group] Define pricing model: Develop a formal proposal for a one-time fixed setup fee and a recurring platform maintenance charge for clients.
* [Kris] Organize submissions: Add an unread indicator and acknowledge button to the submissions tab.
* [Jason] Set error alerts: Configure alerts in error tracking to monitor application issues.
* [Kris] Add archive: Implement a function to archive test submissions.
* [Kris] Verify attribution: Investigate and confirm proper logging of Google Ad UTM sources.
* [Jason] Negotiate SMG services: Reach out to David to discuss reducing services and rates for SMG.
* [Jason] Refine website copy: Edit website content line by line to remove filler and improve clarity.
* [Jason] Run email capture test: Conduct an AB test on email collection to determine optimal timing in the user journey.
* [The group] Define service tiers: Outline managed service components and identify potential free tiers to offer clients.
* [The group] Gather Information: Extract requirements and data from the client during the upcoming meeting.
* [The group] Create Proposal: Draft a scope and fee structure based on the gathered client information.
* [Jason] Resend Invitation: Provide the PTS partner invite to the recipient after the previous one expired.
* [Jason] Install Application: Deploy the software to the target store to test product generation and order flow.
* [The group] Develop Shopify Connector: Partner on the technical implementation of the app during the scheduled visit.

---

## Full notes

Summary
The team discussed service pricing models, refined marketing strategies, and standardized technical communication through updated language protocols.

Establishing New Pricing Models
The team decided to adopt a new pricing structure consisting of 1 setup fee followed by a recurring platform fee. This model replaces previous hourly billing to ensure stable revenue.

Improving Technical Communication Clarity
Adopting Simplified Technical English ensures consistent communication in website copy and AI interactions. This protocol eliminates ambiguity and reduces the need for repeated patching of generated content.

Optimizing Shopify Partner Revenue
Leveraging the Shopify partner program generates value through referral fees and revenue sharing. Focusing on reusable connector services improves integration efficiency and creates long term strategic assets.

Decisions — Aligned

* Marketing data response centralization: Jason is designated as the point person for responding to marketing data to centralize the communication process.
* Submission screen organizational improvements: The submissions interface will be updated to include organizational features such as unread status indicators, acknowledgment buttons, and count badges.
* Submission archive functionality: An archive feature will be added to the submission system to allow for the efficient management of test or irrelevant entries.
* Monitoring services attribution strategy: Error tracking and uptime monitoring services will be offered for free in exchange for including 'Powered by' attribution branding in client email templates.
* Strategy for building client case studies: The team will target two to three existing clients to offer free Shopify integration connectors as a strategic approach to build case studies and validate their product.
* BBX meeting negotiation strategy: The team agreed to adopt an information-gathering stance for the upcoming BBX meeting, explicitly deciding not to provide immediate pricing or scope commitments during the discussion.
* Shopify app connector deployment architecture: The team will implement a deployment architecture where a distinct, publicly listed Shopify app is created for each individual store to function as the connector to their custom dashboard.

Details

* Room Acoustics Improvements: Jason Desiderio discussed making improvements to their mixing room, including setting up speaker stands and filling window spaces with 703 acoustic material, which allowed them to better perceive the stereo field and instrument frequency (00:00:04).
* Meeting Rescheduling: Due to the passing of Matt's grandmother, the team rescheduled their meeting to the following Monday, where they plan to check if the Precision Sounds studio is available, though they may opt to simply meet socially if the studio is unavailable (00:01:15).
* Business Outreach Progress: Jason Desiderio noted that their outreach efforts are gaining traction and they are beginning to see positive signals from potential clients, specifically highlighting a successful reconnection with the owner of Butler Design (00:03:22).
* Austin Business and Tech Landscape: Kris Crawford and Jason Desiderio discussed emerging companies in the Austin area, noting interest in American Housing's component-based construction, Icon 3D printing technology, and energy-focused startups like Ambrosia Energy and Bass Power Company (00:05:22).
* Local Legislative and Corporate Climate: The speakers touched upon the shifting business climate in Austin, including discussions on housing density rules, energy grid bottlenecks, and local uncertainty regarding legislation affecting marijuana-adjacent compounds, alongside the corporate consolidation of XAI and Tesla (00:06:23) (00:08:41).
* Comparison of Business Environments: Jason Desiderio and Kris Crawford compared the startup environments of Austin and New York City, noting that Austin offers a more accessible community, a reinvigorated music scene, and lower barriers to entry for establishing Limited Liability Companies (00:12:01).
* Reflection on Personnel and Processes: Kris Crawford and Jason Desiderio discussed previous team dynamics, agreeing that their progress accelerated after a former teammate departed and they moved away from the complex documentation the teammate had implemented in favor of simpler, more direct processes (00:15:40).
* Marketing Strategy and Automation: Jason Desiderio reported on using Claude to manage Google Ads, including plans to remove incorrectly matched search terms and launch a new ad group targeting competitors like Odoo, ClickUp, Notion, and Airtable (00:17:33).
* Client Outreach Strategy for Eugene: Kris Crawford plans to approach Eugene by offering an in-person meeting at their office to provide assistance, focusing on helping Eugene transition from working "in" the business to working "on" the business (00:20:05).
* Development of New Pricing Model: The team explored a new pricing structure involving a one-time setup fee for dashboard configuration, followed by a recurring platform fee for infrastructure maintenance and monitoring, which would provide more stable cash flow compared to hourly blocks (00:22:38) (00:34:44).
* Canvas Tool Development: Kris Crawford demonstrated updates to the Canvas tool, which allows for context-based chat with documents and images, while Jason Desiderio suggested that adopting a visual, node-based workflow similar to Figma Weave could be beneficial for product direction (00:25:55).
* Product Infrastructure and Efficiency: Jason Desiderio proposed using Vercel to host K3 models, noting it could offer significant cost reductions compared to current Claude usage, and agreed on the need for clearer product direction for the "playground" environment (00:29:38) (00:31:41).
* Internal Knowledge Management: The team discussed the need for an internal wiki or intranet to capture company decisions and processes, observing that decentralized, chat-based knowledge sharing often becomes disorganized as companies grow (00:35:58).
* Submissions and Organizational Features: Kris Crawford and Jason Desiderio discussed adding organizational features to the submissions tab, such as an "unread" status, acknowledgment buttons, and an archive function to better manage potential leads and test data (00:40:56) (00:50:00).
* Analytics and Attribution Troubleshooting: Jason Desiderio reported on using PostHog for error tracking and conversion funnel analysis, though they identified a need to troubleshoot discrepancies in Google Ads attribution data (00:41:54) (00:44:18).
* Optimization of the Audit Funnel: The team discussed improving the audit process, potentially by adding free-form text inputs to better gauge user intent, adjusting the timing of email capture to optimize conversion, and performing A/B tests on user flows (00:46:13).
* Growth and Referral Strategy: Kris Crawford proposed a referral strategy inspired by PayPal, suggesting that offering services in exchange for branding or "powered by" attribution on client communications could increase visibility and serve as an organic growth mechanism (00:53:28).
* Email Service Billing Strategy: Kris and Jason discussed the possibility of absorbing costs for email services, such as Resend, rather than charging clients directly, specifically for transactional emails like password resets. They agreed this could function as a marketing and acquisition cost rather than a fee, and they proposed implementing a cap, such as 500 free sends per month, while developing product components and free tiers to enhance their branding (00:58:26).
* Service Provider Cost Optimization: Kris and Jason reviewed their current expenses and discussed potentially renegotiating with SMG, identified as their largest service expense, to reduce the scope of services to better align with their current revenue (01:00:27). Jason noted that they have spent $51 on ads to date and that their strong margins allow them to absorb higher acquisition costs per client, which they would recoup on the first project block. Jason committed to reaching out to David to inquire about a minimum service rate (01:01:29).
* AI Project Management Strategy: Jason and Kris explored the use of the Claude platform for project management, discussing the benefits of sharing projects across their team and leveraging workspaces and markdown files as a wiki structure (01:02:53). Kris expressed reservations about relying on the AI's "memory" for scaling purposes, arguing that it is more effective to provide the platform with raw data for the agent to traverse rather than relying on the model to compact information internally (01:06:29).
* Simplified Technical English Implementation: Jason introduced the concept of "Simplified Technical English," a system used in aerospace to remove double meanings and reduce ambiguity in technical documentation (01:09:41). They agreed that incorporating this into their AI interactions and website copy would help ensure clearer communication and prevent the ongoing necessity of patching AI outputs (01:10:55).
* Workbench Tools and Structured Output: Kris and Jason reviewed the capabilities of their current workbench tools, specifically noting the functionality for testing skills within workspaces and the availability of structured output features (01:12:36).
* Client Case Study Development: Kris and Jason agreed that creating case studies is critical for client acquisition, identifying the "Up the Wall" Shopify app project as a potential prime candidate (01:14:10). Kris suggested that for existing clients, they could offer to integrate specific services, such as Shopify connections, for free to establish proof-of-concept success stories and develop repeatable connectors (01:15:21).
* Website Copy Optimization: Jason proposed performing a line-by-line review of their website copy to strip away filler text and apply the principles of Simplified Technical English (01:15:21). They aimed to make the website content more direct and engineering-focused, drawing on the workflow previously used for the "Good for Nothing" site (01:16:26).
* The Sorting Table Project Requirements: Kris highlighted that "The Sorting Table" is a custom store utilizing an older fulfillment service that does not natively integrate with Shopify, representing a significant technical hurdle (01:17:26). Kris prioritized determining whether a technical connection is possible or if the fulfillment process will remain a manual one (01:18:29).
* Upcoming BBX Call Strategy: Kris and Jason discussed their approach to an upcoming call with BBX, agreeing not to provide specific pricing figures immediately (01:19:34). Instead, they planned to gather information regarding the project scope and requirements, while also considering the opportunity to pitch their internal tools and AI capabilities (01:20:36).
* Pricing and Retainer Model Considerations: Kris and Jason discussed the potential for a regular retainer model, agreeing to remain cautious and avoid hasty decisions until they better understand the project requirements. They noted that their current fee structure, which includes origination and closer fees, provides a buffer that could be leveraged to secure recurring revenue if needed (01:21:34).
* Shopify App Connector Strategy: Kris and Jason discussed developing Shopify apps as connectors between merchant dashboards and the backend (01:24:49) (01:27:02). They clarified that while publicly listed apps require a review process, unlisted apps can be deployed for individual stores without the same gates (01:26:07). Jason described their current implementation of webhooks for order creation, rejection, and cancellation, which they identified as a reusable connector service for future clients (01:27:02).
* Shopify Partner Program Benefits: Jason and Kris reviewed the financial benefits of the Shopify Partner Program, specifically noting the $2,500 one-time referral fee for Shopify Plus and the 20% revenue share for 24 months for Point of Sale implementations. They acknowledged the high "stickiness" of point-of-sale systems, which makes them a long-term strategic asset for their clients (01:29:19).
