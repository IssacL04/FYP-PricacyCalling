# Privacy-Calling System

## Proposal

* The call initiator(**Caller**) knows the target's phone number and initiates the call through software, but the target(**Callee**) does not know the call initiator's number.
* Modifications can **only be made to the call initiator**; the operator's VoIP link and the call recipient's end remain unchanged.

## System Design

### Math Intuition

**Identity Space **：Let $\mathbb{I}$ be the infinite set of all possible Caller Identities (Caller IDs). 

* Let $id_C \in \mathbb{I}$ be the true identity of the Caller, $C$.
* Let $id_T \in \mathbb{I}$ be the true identity of the Target, $T$.
* Let $\mathbb{V} \subset \mathbb{I}$ be a finite subset of "Virtual Identities" (your number pool), such that $id_C \notin \mathbb{V}$.

**Network Operator **：Let $\mathcal{N}$ be the carrier's Public Telephone Network (PSTN) operator.

* $\mathcal{N}$ accepts an ordered pair $(id_{\text{from}}, id_{\text{to}})$ as input and establishes a connection.
* The perception function of the target $T$ is $\text{Perceive}_T(\cdot)$, which returns the call source $id_{\text{from}}$ as seen by $T$.

**Privacy Middleware** ：The core of $\mathcal{M}$ is an **Identity Transformation Function, $\Phi$**.

------

**Process 1: Normal Calling(without middleware M)**

* The caller $C$ initiates a call intent $Call(C, T)$.
* The system maps this intent directly to the network operator:$$\mathcal{N}(id_C, id_T)$$
* The target $T$'s perceived result is:$$\text{Perceive}_T(\mathcal{N}(id_C, id_T)) = id_C$$

**Process 2: Privacy Calling(via middleware M)**

* The caller $C$ initiates a call intent $Call(C, T)$, but this intent is directed to the middleware $\mathcal{M}$.
  * $$\text{Request}_{\text{init}}(C, \mathcal{M}, id_T)$$
* The $\mathcal{M}$ operator learns the true identity $id_C$ of $C$ via authentication.
* $\mathcal{M}$ applies its core **Identity Transformation Function $\Phi$**.
  * $\Phi$ takes a "real call pair" $(id_C, id_T)$ as input.
  * $\Phi$ selects an element $id_v$ from the virtual identity set $\mathbb{V}$ (via some selection policy $\text{select}(\cdot)$).
  * $\Phi$ outputs a "masked call pair" $(id_v, id_T)$.
  * $$  \Phi: (\mathbb{I} \times \mathbb{I}) \to (\mathbb{V} \times \mathbb{I})$$      $$  \Phi(id_C, id_T) = (id_v, id_T), \quad \text{where } id_v \leftarrow \text{select}(\mathbb{V}, id_C, id_T)$$
* The $\mathcal{M}$ operator submits the transformed result $(id_v, id_T)$ to the network operator $\mathcal{N}$:
  * $$\mathcal{N}(\Phi(id_C, id_T)) \equiv \mathcal{N}(id_v, id_T)$$
  * The target $T$'s perceived result is:$$\text{Perceive}_T(\mathcal{N}(id_v, id_T)) = id_v \neq id_C$$

**Media Flow Abstraction**

The $\mathcal{M}$ operator must also contain a **Media Bridging Function, $\mathcal{B}$**.

- Let $S_C$ be the media stream between the caller $C$ and the middleware $\mathcal{M}$.
- Let $S_T$ be the media stream between the middleware $\mathcal{M}$ and the target $T$ (carried by $\mathcal{N}(id_v, id_T)$).
- $\mathcal{M}$ establishes and maintains a connection:$$  \text{Connection}_{\text{media}} = \mathcal{B}(S_C, S_T)$$

### Workflow

**Call intent**

* The Caller $C$ (identity $id_C$), via their client software, submits a call request to the "Middleware" operator $\mathcal{M}$.
* This request is logically represented as $\text{Request}_{\text{init}}(C, \mathcal{M}, id_T)$, where $id_T$ is the identity of the Target.

**Authentication**

* The operator $\mathcal{M}$ authenticates $C$, thereby learning their true identity $id_C$.
* $\mathcal{M}$ immediately applies its core **Identity Transformation Function $\Phi$**.
* $\Phi$ selects an $id_v$ from the virtual identity set $\mathbb{V}$ and generates a new call pair:$$  (id_v, id_T) \leftarrow \Phi(id_C, id_T)$$

**Session Decoupling**

* $\mathcal{M}$ decouples the original $C \to T$ call intent into two independent session legs.
* **Stream A ($S_C$):** A media stream is established between $C$ and $\mathcal{M}$.
* **Stream B ($S_T$):** A media stream is prepared to be established between $\mathcal{M}$ and $T$.

**Network Submission**

* $\mathcal{M}$ submits the **transformed** call pair $(id_v, id_T)$ to the public network operator $\mathcal{N}$.
* $\mathcal{N}$ executes the call operation:$$\mathcal{N}(id_v, id_T)$$

**Target Perception(Network)**

* The Target $T$'s device receives the call via the network $\mathcal{N}$.$T$'s perception function, $\text{Perceive}_T(\cdot)$, activates. The perceived source of the call is $id_v$.
* $\text{Perceive}_T(\mathcal{N}(id_v, id_T)) = id_v$.As $id_v \neq id_C$, the caller's identity is successfully hidden.

**Media Bridging**

* When the Target $T$ answers the call from $\mathcal{N}$, Stream $S_T$ becomes active.

* The $\mathcal{M}$ operator immediately executes its **Media Bridging Function $\mathcal{B}$**, stitching the two independent media streams ($S_C$ and $S_T$) together.

* The final connection is:$$  \text{Connection} = \mathcal{B}(S_C, S_T)$$;$C$ and $T$ can now talk, with their media relayed through $\mathcal{M}$.

  

![image-20251106193854718](https://cdn.jsdelivr.net/gh/IssacL04/IHS@img/img/image-20251106193854718.png)

![未命名绘图.drawio](https://cdn.jsdelivr.net/gh/IssacL04/IHS@img/img/%E6%9C%AA%E5%91%BD%E5%90%8D%E7%BB%98%E5%9B%BE.drawio.png)

![未命名绘图.drawio (3)](https://cdn.jsdelivr.net/gh/IssacL04/IHS@img/img/%E6%9C%AA%E5%91%BD%E5%90%8D%E7%BB%98%E5%9B%BE.drawio%20(3).png)

![未命名绘图.drawio (2)](https://cdn.jsdelivr.net/gh/IssacL04/IHS@img/img/%E6%9C%AA%E5%91%BD%E5%90%8D%E7%BB%98%E5%9B%BE.drawio%20(2).png)