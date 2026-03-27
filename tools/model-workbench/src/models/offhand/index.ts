import { registry } from "../registry";
import { ShieldKite } from "./ShieldKite";
import { ShieldTower } from "./ShieldTower";
import { ShieldBuckler } from "./ShieldBuckler";
import { Tome } from "./Tome";
import { Torch } from "./Torch";

registry.register(new ShieldKite());
registry.register(new ShieldTower());
registry.register(new ShieldBuckler());
registry.register(new Tome());
registry.register(new Torch());
