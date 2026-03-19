"use strict";

import UserService from "../services/UserService.js";
import UserDTO from "../dto/UserDTO.js";

 // UserController (page réservé aux ADMINS)

 class UserController {

    // Liste de tout les utilisateurs de l'app

    async index(req, res) {
        const users = await UserService.getAllUserById(); // Fonction à créer (el la pas fait :( )) -> Je la met en bas de ce fichier
        res.render("pages/users/index", {
            title: "Utilisateurs",
            users: users.map(UserDTO.fromEntity),
        });
    }

    // Détails utilisateur (admin) (an ne pas mettre dans profil car l'index profil sert déja à ça)

    async show(req, res) {
        const user = await UserService.getById(req.params.id);

        if (!user) {
            return res.status(404).render("pages/error/404");
        }

        res.render("pages/user/show", {
            title: user.pseudo,
            user: UserDTO.fromEntity(user),
        });
    }
 }

 export default new UserController();



//    static async getAll(userId) {
//     return UserRepository.findAllAdmin(userId);
//   }