import { Debug } from '../../../core/debug.js';

import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';

import { MOTION_LOCKED, JOINT_TYPE_6DOF } from './constants.js';

class LinearAngularPair {
    constructor(joint, linear, angular) {
        this._joint = joint;
        this._linear = linear;
        this._angular = angular;
    }

    set linear(linear) {
        this._linear = linear;
        this._joint._updateLinear();
    }

    get linear() {
        return this._linear;
    }

    set angular(angular) {
        this._angular = angular;
        this._joint._updateAngular();
    }

    get angular() {
        return this._angular;
    }

    update() {
        this._joint._updateAngular();
        this._joint._updateLinear();
    }
}

class ObservedXYZ {
    constructor(update, x, y, z) {
        this._update = update;
        this._x = x;
        this._y = y;
        this._z = z;
    }

    set x(x) {
        this._x = x;
        this._update();
    }

    get x() {
        return this._x;
    }

    set y(y) {
        this._y = y;
        this._update();
    }

    get y() {
        return this._y;
    }

    set z(z) {
        this._z = z;
        this._update();
    }

    get z() {
        return this._z;
    }

    update() {
        this._update();
    }
}

class LinearAngularXYZPair extends LinearAngularPair {
    constructor(joint, { x: lx, y: ly, z: lz }, { x: ax, y: ay, z: az }) {
        const update = () => this.update();
        super(joint, new ObservedXYZ(update, lx, ly, lz), new ObservedXYZ(update, ax, ay, az));
    }
}

/**
 * The JointComponent adds a physics joint constraint linking two physics bodies.
 *
 * @augments Component
 * @ignore
 */
class JointComponent extends Component {
    /**
     * Create a new JointComponent instance.
     *
     * @param {import('./system.js').JointComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        Debug.assert(typeof Ammo !== 'undefined', 'ERROR: Attempting to create a pc.JointComponent but Ammo.js is not loaded');

        /** @type {import('ammojs3').default.btTypedConstraint|null} */
        this._rigidBodyConstraint = null;
        /** @type {import('ammojs3').default.btMultiBodyConstraint|null} */
        this._multiBodyLimitConstraint = null;
        /** @type {import('ammojs3').default.btMultiBodyConstraint|null} */
        this._multiBodyMotorConstraint = null;

        this._type = JOINT_TYPE_6DOF;
        this._isForMultibodyLink = false;
        this._skipMultiBodyChance = false;

        this._entityA = null;
        this._entityB = null;
        this._breakForce = 3.4e+38;
        this._enableCollision = true;

        this._motion = new LinearAngularXYZPair(this, { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED }, { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED });
        this._limits = new LinearAngularXYZPair(this, { x: new Vec2(), y: new Vec2(), z: new Vec2() }, { x: new Vec2(), y: new Vec2(), z: new Vec2() });
        this._springs = new LinearAngularXYZPair(this, { x: false, y: false, z: false }, { x: false, y: false, z: false });
        this._stiffness = new LinearAngularPair(this, new Vec3(0, 0, 0), new Vec3(0, 0, 0));
        this._damping = new LinearAngularPair(this, new Vec3(0.1, 0.1, 0.1), new Vec3(0.1, 0.1, 0.1));
        this._equilibrium = new LinearAngularPair(this, new Vec3(0, 0, 0), new Vec3(0, 0, 0));

        this.on('beforeremove', this._onBeforeRemove, this);
        this.on('remove', this._onRemove, this);
        this.on('set_enabled', this._onSetEnabled, this);
    }

    get motion() {
        return this._motion;
    }

    get limits() {
        return this._limits;
    }

    get springs() {
        return this._springs;
    }

    get stiffness() {
        return this._stiffness;
    }

    get damping() {
        return this._damping;
    }

    get equilibrium() {
        return this._equilibrium;
    }

    /**
     * @type {import('ammojs3').default.btTypedConstraint|null}
     */
    set rigidBodyConstraint(constraint) {
        if (this.enabled) {
            const app = this.system.app;
            const dynamicsWorld = app.systems.physics.dynamicsWorld;
            if (this._multiBodyLimitConstraint) {
                dynamicsWorld.removeConstraint(this._rigidBodyConstraint);
                Ammo.destroy(this._rigidBodyConstraint);
            }
            if (constraint) {
                dynamicsWorld.addConstraint(constraint, !this._enableCollision);
            }
        }

        this._rigidBodyConstraint = constraint;
    }

    get rigidBodyConstraint() {
        return this._rigidBodyConstraint;
    }

    /**
     * @type {import('ammojs3').default.btMultiBodyConstraint|null}
     */
    set multiBodyLimitConstraint(constraint) {
        if (this.enabled) {
            const app = this.system.app;
            const dynamicsWorld = app.systems.physics.dynamicsWorld;
            if (this._multiBodyLimitConstraint) {
                dynamicsWorld.removeMultiBodyConstraint(this._multiBodyLimitConstraint);
                Ammo.destroy(this._multiBodyLimitConstraint);
            }
            if (constraint) {
                dynamicsWorld.addMultiBodyConstraint(constraint);
            }
        }

        this._multiBodyLimitConstraint = constraint;
    }

    get multiBodyLimitConstraint() {
        return this._multiBodyLimitConstraint;
    }

    /**
     * @type {import('ammojs3').default.btMultiBodyConstraint|null}
     */
    set multiBodyMotorConstraint(constraint) {
        if (this.enabled) {
            const app = this.system.app;
            const dynamicsWorld = app.systems.physics.dynamicsWorld;
            if (this._multiBodyMotorConstraint) {
                dynamicsWorld.removeMultiBodyConstraint(this._multiBodyMotorConstraint);
                Ammo.destroy(this._multiBodyMotorConstraint);
            }
            if (constraint) {
                dynamicsWorld.addMultiBodyConstraint(constraint);
            }
        }

        this._multiBodyMotorConstraint = constraint;
    }

    get multiBodyMotorConstraint() {
        return this._multiBodyMotorConstraint;
    }

    set type(type) {
        if (this._type !== type) {
            this._type = type;
            this._createConstraint(undefined);
        }
    }

    get type() {
        return this._type;
    }

    get isForMultibodyLink() {
        return this._isForMultibodyLink;
    }

    /**
     * Whether or not this joint would skip the chance to make a multibody link.
     *
     * @type {boolean}
     */
    set skipMultiBodyChance(skip) {
        if (this._skipMultiBodyChance && !skip) {
            this._addMultiBodyEventHandlers();
            if (this.entityA?.multibody?.couldBeInMultibody) {
                this._createConstraint(undefined);
            }
        } else if (!this._skipMultiBodyChance && skip) {
            this._removeMultiBodyEventHandlers();
            if (this.entityA?.multibody?.isInMultibody) {
                this._createConstraint(undefined);
            }
        }

        this._skipMultiBodyChance = skip;
    }

    get skipMultiBodyChance() {
        return this._skipMultiBodyChance;
    }

    set entityA(body) {
        if (this._entityA && !this._skipMultiBodyChance) {
            this._removeMultiBodyEventHandlers();
        }
        // this._destroyConstraint();
        this._entityA = body;
        if (this._entityA && !this._skipMultiBodyChance) {
            this._addMultiBodyEventHandlers();
        }
        this._createConstraint(undefined);
    }

    /**
     * The first entity in this constraint.
     *
     * If an entity is specified that does not have a {@link PhysicsComponent},
     * then the closest parent of that entity with a {@link PhysicsComponent}
     * will be used, preserving the relative transform.
     *
     * If {@link isForMultibodyLink} is true, then this entity will be the
     * parent multibody link.
     *
     * @type {import('../../entity').Entity}
     */
    get entityA() {
        return this._entityA;
    }

    set entityB(body) {
        // this._destroyConstraint(undefined);
        this._entityB = body;
        this._createConstraint(undefined);
    }

    /**
     * The second entity in this constraint.
     *
     * If an entity is specified that does not have a {@link PhysicsComponent},
     * then the closest parent of that entity with a {@link PhysicsComponent}
     * will be used, preserving the relative transform.
     *
     * If {@link isForMultibodyLink} is true, then this entity will be the
     * child multibody link.
     *
     * @type {import('../../entity').Entity}
     */
    get entityB() {
        return this._entityB;
    }

    set breakForce(force) {
        if (this._breakForce !== force) {
            this._breakForce = force;
            this._updateOther();
        }
    }

    get breakForce() {
        return this._breakForce;
    }

    set enableCollision(enableCollision) {
        // this._destroyConstraint();
        this._enableCollision = enableCollision;
        this._createConstraint(undefined);
    }

    get enableCollision() {
        return this._enableCollision;
    }

    _convertTransform(pcTransform, ammoTransform) {
        const pos = pcTransform.getTranslation();
        const rot = new Quat();
        rot.setFromMat4(pcTransform);

        const ammoVec = new Ammo.btVector3(pos.x, pos.y, pos.z);
        const ammoQuat = new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w);

        ammoTransform.setOrigin(ammoVec);
        ammoTransform.setRotation(ammoQuat);

        Ammo.destroy(ammoVec);
        Ammo.destroy(ammoQuat);
    }

    /** @private */
    _updateAngular() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this.system.updateAngularParameters(this);
    }

    /** @private */
    _updateLinear() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this.system.updateLinearParameters(this);
    }

    /** @private */
    _updateOther() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this.system.updateOtherParameters(this);
    }

    /**
     * @private
     * @param {import('../multibody/system').MultiBodySetup|undefined} multiBodySetup
     */
    _createConstraint(multiBodySetup) {
        this._isForMultibodyLink = !this._skipMultiBodyChance && (this._entityA?.multibody?.couldBeInMultibody ?? false);
        if (this._isForMultibodyLink && !multiBodySetup) {
            // If this joint is making a multibody link, then this method should be called from the multibody's setup event
            this.entityA.multibody.createBody();
            return;
        }

        if (this._entityA?.physics) {
            if (!this._isForMultibodyLink) {
                this._destroyConstraint(undefined);
            }

            const mat = new Mat4();

            this._entityA.physics.activate();

            const jointWtm = this.entity.getWorldTransform();

            const entityAWtm = this._entityA.getWorldTransform();
            const invEntityAWtm = entityAWtm.clone().invert();
            mat.mul2(invEntityAWtm, jointWtm);

            const frameA = new Ammo.btTransform();
            const frameB = new Ammo.btTransform();

            this._convertTransform(mat, frameA);

            if (this._entityB?.physics) {
                this._entityB.physics.activate();

                const entityBWtm = this._entityB.getWorldTransform();
                const invEntityBWtm = entityBWtm.clone().invert();
                mat.mul2(invEntityBWtm, jointWtm);

                this._convertTransform(mat, frameB);
            }

            this.system.createJoint(this._entityA, this._entityB, this, frameA, frameB);

            Ammo.destroy(frameB);
            Ammo.destroy(frameA);

            this._updateAngular();
            this._updateLinear();
            this._updateOther();
        }
    }

    /**
     * @private
     * @param {import('../multibody/system').MultiBodySetup|undefined} multiBodySetup
     */
    _destroyConstraint(multiBodySetup) {
        const app = this.system.app;
        const dynamicsWorld = app.systems.physics.dynamicsWorld;

        if (this._isForMultibodyLink && !multiBodySetup) {
            // If this joint is making a multibody link, then this method should be called from the multibody's unsetup event
            this.entity.multibody.removeLinkFromMultiBody();
            return;
        }

        if (this._rigidBodyConstraint) {
            dynamicsWorld.removeConstraint(this._rigidBodyConstraint);
            Ammo.destroy(this._rigidBodyConstraint);
            this._rigidBodyConstraint = null;
        } else {
            if (this._multiBodyLimitConstraint) {
                dynamicsWorld.removeMultiBodyConstraint(this._multiBodyLimitConstraint);
                Ammo.destroy(this._multiBodyLimitConstraint);
                this._multiBodyLimitConstraint = null;
            }
            if (this._multiBodyMotorConstraint) {
                dynamicsWorld.removeMultiBodyConstraint(this._multiBodyMotorConstraint);
                Ammo.destroy(this._multiBodyMotorConstraint);
                this._multiBodyMotorConstraint = null;
            }
        }
    }

    initFromData(data) {
        // TODO: implement

        this._createConstraint(undefined);
    }

    onEnable() {
        this._createConstraint(undefined);
    }

    onDisable() {
        this._destroyConstraint(undefined);
    }

    _onSetEnabled(prop, old, value) {
    }

    _onBeforeRemove() {
        this.fire('remove');
    }

    _onRemove() {
        this._destroyConstraint(undefined);
    }

    /**
     * @private
     */
    _addMultiBodyEventHandlers() {
        if (!this.skipMultiBodyChance) {
            if (!this._entityA.multibody) {
                this._entityA.addComponent('multibody');
            }

            this._entityA.multibody.on('beforeSetup', this._entityA_multibody_beforeSetup, this);
            this._entityA.multibody.on('setup', this._createConstraint, this);
            this._entityA.multibody.on('unsetup', this._destroyConstraint, this);
        }
    }

    /**
     * @private
     */
    _removeMultiBodyEventHandlers() {
        if (!this._entityA?.multibody) {
            return;
        }

        this._entityA?.multibody?.off('beforeSetup', this._entityA_multibody_beforeSetup, this);
        this._entityA?.multibody?.off('setup', this._createConstraint, this);
        this._entityA?.multibody?.off('unsetup', this._destroyConstraint, this);
    }

    /**
     * Event handler for entityA.multibody:beforeSetup.
     *
     * @private
     * @param {import('../multibody/system').MultiBodySetup} multibodySetup - The multibody setup for the eligibility check
     */
    _entityA_multibody_beforeSetup(multibodySetup) {
        multibodySetup.links.push(this.entityA);
    }
}

export { JointComponent };
